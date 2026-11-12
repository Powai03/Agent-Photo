"use client";

import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#e3a857" },
    background: { default: "#121110", paper: "#1c1a18" },
    text: { primary: "#f2ede6", secondary: "#a59d92" },
    divider: "#34302b",
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    h1: { fontSize: "1.75rem", fontWeight: 700 },
    h2: { fontSize: "1.15rem", fontWeight: 600 },
    h3: { fontSize: "0.8rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" },
  },
  components: {
    MuiPaper: { defaultProps: { variant: "outlined" } },
    MuiButton: { styleOverrides: { root: { textTransform: "none", fontWeight: 600 } } },
    MuiTab: { styleOverrides: { root: { textTransform: "none", fontWeight: 600 } } },
  },
});

export default theme;
