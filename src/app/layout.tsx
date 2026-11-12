import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import type { Metadata } from "next";
import theme from "@/theme";

export const metadata: Metadata = {
  title: "Agent Photo",
  description: "Réglages de retouche iPhone et Lightroom adaptés à chaque photo",
};

const RootLayout: React.FC<React.PropsWithChildren> = ({ children }) => (
  <html lang="fr">
    <body>
      <AppRouterCacheProvider>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          {children}
        </ThemeProvider>
      </AppRouterCacheProvider>
    </body>
  </html>
);

export default RootLayout;
