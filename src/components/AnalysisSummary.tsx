import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { LIGHT_LABELS, SCENE_LABELS, TRAIT_LABELS } from "@/utils/types";
import type { Analysis } from "@/utils/types";

interface AnalysisSummaryProps {
  analysis: Analysis;
}

interface BulletListProps {
  title: string;
  items: string[];
}

const BulletList: React.FC<BulletListProps> = ({ title, items }) => (
  <Box>
    <Typography variant="h3" gutterBottom>
      {title}
    </Typography>
    <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
      {items.map((item) => (
        <Typography key={item} component="li" variant="body2">
          {item}
        </Typography>
      ))}
    </Box>
  </Box>
);

const AnalysisSummary: React.FC<AnalysisSummaryProps> = ({ analysis }) => {
  const isSceneOverridden = analysis.sceneType !== analysis.detectedSceneType;
  const tags = [
    LIGHT_LABELS[analysis.light],
    `Météo : ${analysis.weather.toLowerCase()}`,
    analysis.timeOfDay,
    analysis.focalType,
  ];

  return (
    <Paper sx={{ p: 3 }}>
      <Stack spacing={2}>
        <Box>
          <Typography variant="h2">
            {SCENE_LABELS[analysis.sceneType]}
            {analysis.isNight && analysis.sceneType !== "night" ? " de nuit" : ""}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {isSceneOverridden
              ? `Type choisi manuellement (détecté : ${SCENE_LABELS[analysis.detectedSceneType].toLowerCase()}).`
              : "Type détecté automatiquement à partir des pixels et de l'EXIF : corrigez-le s'il est faux."}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
          {tags.map((tag) => (
            <Chip key={tag} label={tag} size="small" variant="outlined" />
          ))}
          {analysis.traits.map((trait) => (
            <Chip key={trait} label={TRAIT_LABELS[trait]} size="small" color="primary" variant="outlined" />
          ))}
        </Box>
        {analysis.dominantColors.length > 0 && (
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5 }}>
            {analysis.dominantColors.map((color) => (
              <Box key={color.name} sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                <Box
                  sx={(theme) => ({
                    width: theme.spacing(2),
                    height: theme.spacing(2),
                    borderRadius: "50%",
                    border: `1px solid ${theme.palette.divider}`,
                    backgroundColor: color.hex,
                  })}
                />
                <Typography variant="body2" color="text.secondary">
                  {color.name} {Math.round(color.sharePct)} %
                </Typography>
              </Box>
            ))}
          </Box>
        )}
        <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" } }}>
          <BulletList title="Ce qui aplatit l'image" items={analysis.flatnessDiagnosis} />
          <BulletList title="Mesures" items={analysis.measurements} />
        </Box>
      </Stack>
    </Paper>
  );
};

export default AnalysisSummary;
