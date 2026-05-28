// Phase 2에서 실 알고리즘 구현. Phase 1은 인터페이스만 고정.
export interface CallEdge {
  from: string;
  to: string;
  via?: 'binder' | 'jni' | 'java-call' | 'cpp-call';
}

export interface BinderAnchor {
  aidlInterface: string;
  aidlMember: string;
  cppImpl?: string;
}

export interface JoinerOptions {
  maxDepth: number;
}

export const DEFAULT_JOINER_OPTIONS: JoinerOptions = { maxDepth: 8 };

/**
 * Phase 1 stub: passes input through, no expansion. Phase 2 will implement
 * frontier expansion through callEdges + binderAnchors.
 */
export function joinTraces(
  _edges: CallEdge[],
  _anchors: BinderAnchor[],
  _options: JoinerOptions = DEFAULT_JOINER_OPTIONS,
): { tracesAdded: number } {
  return { tracesAdded: 0 };
}
