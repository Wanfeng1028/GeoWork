import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from '../App'

// Mock react-router to avoid complex routing setup
vi.mock('react-router', () => {
  const React = require('react')
  return {
    RouterProvider: ({ router }: any) => {
      const _routes = router.routes || []
      return React.createElement('div', { 'data-testid': 'app-root' }, [
        React.createElement('div', { key: 'content', 'data-testid': 'router-content' }, 'App Rendered'),
      ])
    },
    createBrowserRouter: (routes: any) => ({ routes }),
    Navigate: () => null,
    useNavigate: () => vi.fn(),
    useLocation: () => ({ pathname: '/' }),
    Outlet: () => null,
  }
})

describe('AppShell / App', () => {
  it('should render without crashing', () => {
    const { container } = render(<App />)
    expect(container).toBeTruthy()
  })

  it('should render the router provider root element', () => {
    render(<App />)
    const root = screen.getByTestId('app-root')
    expect(root).toBeInTheDocument()
  })

  it('should render router content', () => {
    render(<App />)
    const content = screen.getByTestId('router-content')
    expect(content).toHaveTextContent('App Rendered')
  })
})
