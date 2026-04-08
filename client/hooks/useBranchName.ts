import { useQuery } from "@tanstack/react-query";

export function useBranchName(branchId?: string | null): string | undefined {
  // Only fetch if branchId is provided
  const { data } = useQuery({
    queryKey: ["branch-name", branchId],
    queryFn: async () => {
      if (!branchId) return undefined;
      const res = await fetch("/api/branches");
      if (!res.ok) return undefined;
      const { branches } = await res.json();
      const branch = branches.find((b: any) => b.id === branchId);
      return branch?.name;
    },
    enabled: !!branchId,
  });
  return data;
}
