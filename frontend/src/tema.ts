import { createTheme } from '@mui/material';

const AZUL_UTN = '#0a3d7c';
const CELESTE_UTN = '#1d7be0';

export const tema = createTheme({
  colorSchemes: {
    light: {
      palette: {
        primary: { main: AZUL_UTN },
        secondary: { main: CELESTE_UTN },
        error: { main: '#c43c2c' },
        warning: { main: '#b86e00' },
        success: { main: '#2e7d4f' },
        background: { default: '#f4f7fb', paper: '#ffffff' },
        divider: '#dde3ec',
        text: { primary: '#12233a', secondary: '#55667d' },
      },
    },
    dark: {
      palette: {
        primary: { main: '#7db4f0' },
        secondary: { main: '#4da3ff' },
        error: { main: '#ff8a7a' },
        warning: { main: '#f0b04a' },
        success: { main: '#6fcf97' },
        background: { default: '#0d1626', paper: '#142036' },
        divider: '#26364f',
      },
    },
  },
  shape: { borderRadius: 8 },
  typography: {
    fontFamily: '"Source Sans 3", system-ui, "Segoe UI", sans-serif',
    h4: { fontWeight: 700 },
    h5: { fontWeight: 700 },
    h6: { fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  components: {
    MuiAppBar: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: { backgroundColor: AZUL_UTN, color: '#ffffff' },
      },
    },
    MuiPaper: {
      styleOverrides: {
        outlined: ({ theme }) => ({ borderColor: theme.palette.divider }),
      },
    },
    MuiButton: { defaultProps: { disableElevation: true } },
    MuiTableCell: {
      styleOverrides: {
        head: ({ theme }) => ({
          fontWeight: 600,
          color: theme.palette.text.secondary,
          backgroundColor: theme.palette.action.hover,
        }),
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: ({ theme }) => ({
          '&.MuiTableRow-hover:hover': {
            backgroundColor: theme.palette.action.hover,
          },
        }),
      },
    },
  },
});
