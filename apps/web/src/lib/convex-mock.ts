/**
 * convex/react mock — CENTAUR runs without a Convex backend.
 * All hooks return safe empty values instead of throwing.
 */

export const useQuery = (_query: unknown, ..._args: unknown[]) => undefined;
export const useMutation = (_mutation: unknown) => async (..._args: unknown[]) => undefined;
export const useAction = (_action: unknown) => async (..._args: unknown[]) => undefined;
export const useConvex = () => null;
export const usePaginatedQuery = (_query: unknown, ..._args: unknown[]) => ({
  results: [],
  status: "Exhausted" as const,
  loadMore: () => {},
});
export const useQueries = () => ({});
export const ConvexProvider = ({ children }: { children: React.ReactNode }) => children;
export const ConvexReactClient = class {
  constructor(_url: string) {}
};
