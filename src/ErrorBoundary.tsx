import React, { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    const msg = `[ErrorBoundary] ${error.message}\n${error.stack || ''}\n${info.componentStack || ''}`
    console.error(msg)
    if (typeof window !== 'undefined' && (window as unknown as { __crashReport?: (m: string) => void }).__crashReport) {
      (window as unknown as { __crashReport: (m: string) => void }).__crashReport(msg)
    }
  }

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      return (
        <div className="min-h-screen bg-slate-900 text-slate-200 flex items-center justify-center p-6">
          <div className="max-w-md space-y-4">
            <h1 className="text-lg font-semibold text-red-400">Something went wrong</h1>
            <p className="text-sm text-slate-400 font-mono break-all">
              {this.state.error.message}
            </p>
            <p className="text-xs text-slate-500">
              Check the console for details. Refresh the app to try again.
            </p>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
