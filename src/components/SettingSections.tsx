import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { formatSettingValue } from "@/utils/settingSections";
import type { SettingSection } from "@/utils/settingSections";
import type { SettingRow } from "@/utils/types";

interface SettingBarProps {
  row: SettingRow;
}

interface SettingSectionsProps {
  sections: SettingSection[];
}

const toPercent = (row: SettingRow, value: number): number =>
  ((value - row.min) / (row.max - row.min)) * 100;

const SettingBar: React.FC<SettingBarProps> = ({ row }) => {
  const originPct = toPercent(row, Math.max(row.min, 0));
  const valuePct = toPercent(row, row.value);
  const isNeutral = row.value === 0;

  return (
    <Box
      sx={(theme) => ({
        display: "grid",
        alignItems: "center",
        columnGap: 2,
        gridTemplateColumns: `minmax(0, 1fr) minmax(0, 1fr) ${theme.spacing(6)}`,
        color: isNeutral ? theme.palette.text.secondary : theme.palette.text.primary,
      })}
    >
      <Typography variant="body2" noWrap>
        {row.label}
      </Typography>
      <Box
        sx={(theme) => ({
          position: "relative",
          height: theme.spacing(0.5),
          borderRadius: 1,
          backgroundColor: theme.palette.divider,
        })}
      >
        <Box
          sx={(theme) => ({
            position: "absolute",
            top: 0,
            bottom: 0,
            left: `${Math.min(originPct, valuePct)}%`,
            width: `${Math.abs(valuePct - originPct)}%`,
            borderRadius: 1,
            backgroundColor: theme.palette.primary.main,
          })}
        />
      </Box>
      <Typography variant="body2" sx={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
        {formatSettingValue(row)}
      </Typography>
    </Box>
  );
};

const SettingSections: React.FC<SettingSectionsProps> = ({ sections }) => (
  <Stack spacing={2.5}>
    {sections.map((section) => (
      <Box key={section.title}>
        <Typography variant="h3" color="primary" gutterBottom>
          {section.title}
        </Typography>
        <Stack spacing={0.75}>
          {section.rows.map((row) => (
            <SettingBar key={row.label} row={row} />
          ))}
          {section.notes.map((note) => (
            <Typography key={note} variant="body2" color="text.secondary">
              {note}
            </Typography>
          ))}
        </Stack>
      </Box>
    ))}
  </Stack>
);

export default SettingSections;
