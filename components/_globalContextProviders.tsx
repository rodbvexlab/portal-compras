import { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "./Tooltip";
import { ThemeModeProvider } from "../helpers/themeMode";
import { ScrollToHashElement } from "./ScrollToHashElement";
import { AuthProvider } from "../helpers/useAuth";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnMount: false,
      refetchOnWindowFocus: false,
    },
  },
});

export const GlobalContextProviders = ({
  children,
}: {
  children: ReactNode;
}) => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeModeProvider>
        <ScrollToHashElement />
        <AuthProvider>
          <TooltipProvider>
            {children}
          </TooltipProvider>
        </AuthProvider>
      </ThemeModeProvider>
    </QueryClientProvider>
  );
};
