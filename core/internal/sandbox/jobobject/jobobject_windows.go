//go:build windows

// GeoWork Go Core - Job Object process isolation (doc/25 W1)
//
// Job wraps a Windows Job Object so sandboxed child processes — and
// every grandchild they spawn — die together with the sandbox. Two
// limits are set:
//
//   - JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE: closing the job handle kills
//     every process still assigned to it. This is what makes timeout
//     kills reliable: the old code killed only the direct child, so
//     grandchildren (start /b, background &) escaped.
//   - JOB_OBJECT_LIMIT_PROCESS_MEMORY (optional): a per-process commit
//     cap. Allocations beyond the cap fail instead of exhausting the
//     machine. 0 disables the cap.
//
// Usage: create the job, cmd.Start(), then Assign(cmd.Process). The
// returned cleanup closes the job handle — call it after Wait returns.
// If the process is still running when cleanup fires, the job's
// kill-on-close semantics terminate the whole tree.

package jobobject

import (
	"fmt"
	"os"
	"unsafe"

	"golang.org/x/sys/windows"
)

// Job is a live Job Object handle.
type Job struct {
	handle windows.Handle
}

// New creates a Job Object. memLimitMB > 0 sets a per-process commit
// cap in megabytes; 0 leaves memory unbounded.
func New(memLimitMB int) (*Job, error) {
	handle, err := windows.CreateJobObject(nil, nil)
	if err != nil {
		return nil, fmt.Errorf("create job object: %w", err)
	}

	info := windows.JOBOBJECT_EXTENDED_LIMIT_INFORMATION{
		BasicLimitInformation: windows.JOBOBJECT_BASIC_LIMIT_INFORMATION{
			LimitFlags: windows.JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
		},
	}
	if memLimitMB > 0 {
		info.BasicLimitInformation.LimitFlags |= windows.JOB_OBJECT_LIMIT_PROCESS_MEMORY
		info.ProcessMemoryLimit = uintptr(memLimitMB) * 1024 * 1024
	}

	_, err = windows.SetInformationJobObject(
		handle,
		windows.JobObjectExtendedLimitInformation,
		uintptr(unsafe.Pointer(&info)),
		uint32(unsafe.Sizeof(info)),
	)
	if err != nil {
		windows.CloseHandle(handle)
		return nil, fmt.Errorf("set job object limits: %w", err)
	}
	return &Job{handle: handle}, nil
}

// Assign adds a running process to the job. All processes the assigned
// process subsequently spawns join the job automatically (nested jobs
// aside), so the whole tree shares the limits and the kill-on-close.
// os.Process's handle is unexported, so we open a fresh handle with the
// access rights AssignProcessToJobObject needs.
func (j *Job) Assign(p *os.Process) error {
	if j == nil || p == nil {
		return nil
	}
	proc, err := windows.OpenProcess(windows.PROCESS_SET_QUOTA|windows.PROCESS_TERMINATE, false, uint32(p.Pid))
	if err != nil {
		return fmt.Errorf("open process %d: %w", p.Pid, err)
	}
	defer windows.CloseHandle(proc)
	if err := windows.AssignProcessToJobObject(j.handle, proc); err != nil {
		return fmt.Errorf("assign process %d to job: %w", p.Pid, err)
	}
	return nil
}

// Close releases the job handle. Any process still assigned is killed
// (JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE). Safe to call multiple times.
func (j *Job) Close() error {
	if j == nil || j.handle == 0 {
		return nil
	}
	err := windows.CloseHandle(j.handle)
	j.handle = 0
	return err
}
