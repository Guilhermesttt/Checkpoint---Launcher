import { Component, type ReactNode } from "react";

interface RetroPlatformModelBoundaryProps {
  children: ReactNode;
  resetKey: string;
}

interface RetroPlatformModelBoundaryState {
  failed: boolean;
  resetKey: string;
}

export class RetroPlatformModelBoundary extends Component<
  RetroPlatformModelBoundaryProps,
  RetroPlatformModelBoundaryState
> {
  state: RetroPlatformModelBoundaryState = {
    failed: false,
    resetKey: this.props.resetKey,
  };

  static getDerivedStateFromError(): Partial<RetroPlatformModelBoundaryState> {
    return { failed: true };
  }

  static getDerivedStateFromProps(
    props: RetroPlatformModelBoundaryProps,
    state: RetroPlatformModelBoundaryState,
  ): Partial<RetroPlatformModelBoundaryState> | null {
    if (props.resetKey === state.resetKey) return null;
    return { failed: false, resetKey: props.resetKey };
  }

  componentDidCatch(error: unknown): void {
  console.error("[RetroPlatformModelBoundary] falhou:", error);
}

  render() {
    return this.state.failed ? null : this.props.children;
  }
}
