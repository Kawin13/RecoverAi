import { Component, ErrorInfo, ReactNode } from 'react'
import { AlertOctagon, RefreshCw, Home, ChevronRight, ChevronDown } from 'lucide-react'

interface Props {
  children: ReactNode
  fallbackTitle?: string
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  showDetails: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    showDetails: false
  }

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('RecoverAI Uncaught Error Boundary Catch:', error, errorInfo)
    this.setState({ errorInfo })
  }

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false
    })
  }

  private handleReload = () => {
    window.location.reload()
  }

  private handleGoHome = () => {
    window.location.href = '/'
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[400px] flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-surface border border-burnt-orange/30 rounded-md p-6 shadow-fintech-card space-y-4 text-left">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-sm bg-burnt-orange-light text-burnt-orange">
                <AlertOctagon className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-graphite font-display">
                  {this.props.fallbackTitle || 'Component Recovered Gracefully'}
                </h3>
                <p className="text-xs text-warm-gray-500">
                  An unexpected render exception was isolated to prevent system disruption.
                </p>
              </div>
            </div>

            <div className="bg-warm-gray-50 border border-border/80 rounded-sm p-3 text-xs text-warm-gray-700 font-mono leading-relaxed break-words">
              {this.state.error?.message || 'Unknown render exception.'}
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-burnt-orange hover:bg-burnt-orange-dark text-white rounded-sm text-xs font-medium transition-colors shadow-xs"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry Component</span>
              </button>

              <button
                type="button"
                onClick={this.handleReload}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface hover:bg-warm-gray-100 border border-border text-graphite rounded-sm text-xs font-medium transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5 text-warm-gray-500" />
                <span>Reload Page</span>
              </button>

              <button
                type="button"
                onClick={this.handleGoHome}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface hover:bg-warm-gray-100 border border-border text-graphite rounded-sm text-xs font-medium transition-colors"
              >
                <Home className="w-3.5 h-3.5 text-warm-gray-500" />
                <span>Overview</span>
              </button>
            </div>

            {this.state.errorInfo && (
              <div className="pt-2 border-t border-border/60">
                <button
                  type="button"
                  onClick={() => this.setState({ showDetails: !this.state.showDetails })}
                  className="inline-flex items-center gap-1 text-[11px] text-warm-gray-500 hover:text-graphite font-medium transition-colors"
                >
                  {this.state.showDetails ? (
                    <ChevronDown className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5" />
                  )}
                  <span>{this.state.showDetails ? 'Hide Stack Diagnostics' : 'View Diagnostics'}</span>
                </button>

                {this.state.showDetails && (
                  <div className="mt-2 p-3 bg-warm-gray-900 text-warm-gray-200 rounded-sm font-mono text-[10px] max-h-48 overflow-y-auto">
                    <pre className="whitespace-pre-wrap">{this.state.errorInfo.componentStack}</pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
