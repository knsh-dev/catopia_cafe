import React from "react";
import { AlertCircle, RotateCcw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[60vh] flex items-center justify-center p-6 bg-cream">
          <Card className="max-w-md w-full bg-white rounded-3xl border border-border/80 shadow-md p-6 text-center space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <div className="space-y-1.5">
              <h2 className="font-heading text-xl font-bold text-espresso">
                Something went wrong
              </h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                We ran into an unexpected hiccup loading this page. Our café team is on it!
              </p>
            </div>

            {this.state.error?.message && (
              <div className="p-3 bg-latte/60 rounded-xl text-left border border-border/60 text-xs font-mono text-espresso/80 overflow-x-auto max-h-32">
                {this.state.error.message}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              <Button
                variant="outline"
                className="flex-1 rounded-full text-xs"
                onClick={this.handleReset}
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                Try Again
              </Button>
              <Button
                className="flex-1 rounded-full bg-caramel hover:bg-caramel-dark text-white text-xs"
                onClick={() => {
                  window.location.href = "/";
                }}
              >
                <Home className="h-3.5 w-3.5 mr-1.5" />
                Return to Café
              </Button>
            </div>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
