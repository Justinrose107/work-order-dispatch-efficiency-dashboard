import { lazy, Suspense, type ComponentType, type ReactNode } from 'react';

interface DynamicOptions {
  loading?: () => ReactNode;
  ssr?: boolean;
}

export default function dynamic<Props extends object>(
  loader: () => Promise<ComponentType<Props>>,
  options?: DynamicOptions,
): ComponentType<Props> {
  const LazyComponent = lazy(async () => ({ default: await loader() }));

  return function DynamicComponent(props: Props) {
    return (
      <Suspense fallback={options?.loading?.() ?? null}>
        <LazyComponent {...props} />
      </Suspense>
    );
  };
}
