import {
  Plus, Boxes, Timer, MessageCircle, CheckSquare, Hash,
  User, Settings, LogOut, HelpCircle,
} from 'lucide-react'
import { geoAgentCharacterAssets } from '../../brand'
import useShellStore from '../../../stores/shellStore'
import { runAction } from '../../../services/actionRegistry'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu'
import styles from './LeftSidebar.module.scss'

const TASKS = [
  '后端 Agent 规划问题',
  '.qoder\\specs\\周末去...',
  '/model add',
  '规划slot闭环修复',
  '继续修复PlanningGo',
  '修复 PlanningGo UI ...',
  '继续修复PlanningGo',
  'PlanningGo 端到端修...',
]

export function LeftSidebar() {
  const { activeNavKey } = useShellStore()
  const openNav = (key: string) => runAction('switchMainModule', key)

  return (
    <aside className={styles.sidebar}>
      {/* Brand */}
      <div className={styles.brand}>
        <img
          className={styles.logo}
          src={geoAgentCharacterAssets.logo.mark}
          alt="GeoWork"
        />
      </div>

      {/* Main nav */}
      <nav className={styles.nav}>
        <button className={styles.newTaskBtn} onClick={() => openNav('workbench')}>
          <span className={styles.newTaskLeft}>
            <Plus size={15} />
            <span>新任务</span>
          </span>
          <span className={styles.shortcut}>Ctrl + N</span>
        </button>

        <button className={styles.navItem} onClick={() => openNav('extensions')}>
          <Boxes size={15} />
          <span>扩展</span>
        </button>

        <button className={styles.navItem} onClick={() => openNav('scheduler')}>
          <Timer size={15} />
          <span>定时任务</span>
        </button>

        <button className={styles.navItem} onClick={() => openNav('channels')}>
          <MessageCircle size={15} />
          <span>IM 频道</span>
        </button>

        {/* Task / Channel tabs */}
        <div className={styles.tabs}>
          <button className={`${styles.tab} ${activeNavKey === 'tasks' ? styles.active : ''}`}>
            <CheckSquare size={14} />
            <span>任务</span>
          </button>
          <button className={`${styles.tab} ${activeNavKey === 'channels' ? styles.active : ''}`}>
            <MessageCircle size={14} />
            <span>频道</span>
          </button>
        </div>

        <div className={styles.sectionTitle}>任务</div>

        <div className={styles.taskList}>
          {TASKS.map((task) => {
            const isCommand = task.startsWith('/')
            return (
              <button key={task} className={isCommand ? `${styles.taskItem} ${styles.command}` : styles.taskItem}>
                {isCommand ? (
                  <>
                    <span className={styles.commandBadge}>
                      <Hash size={11} />
                      {task.slice(1).split(' ')[0]}
                    </span>
                    <span className={styles.commandRest}>{task.slice(task.indexOf(' ') + 1)}</span>
                  </>
                ) : (
                  <span>{task}</span>
                )}
              </button>
            )
          })}
        </div>
      </nav>

      {/* User area - hidden for now */}
      <div className={styles.userArea}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={styles.userBtn}>
              <div className={styles.userAvatar}>
                <User size={14} />
              </div>
              <div className={styles.userInfo}>
                <div className={styles.userName}>GeoWork User</div>
                <div className={styles.userPlan}>Free</div>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" sideOffset={8} collisionPadding={8} className={styles.userMenu}>
            <DropdownMenuItem onClick={() => openNav('settings')}>
              <Settings size={14} /> 设置
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openNav('workspaces')}>
              <Boxes size={14} /> 工作空间
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <HelpCircle size={14} /> 帮助与反馈
            </DropdownMenuItem>
            <DropdownMenuItem className={styles.logoutItem}>
              <LogOut size={14} /> 退出登录
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  )
}
