import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { Recommendation } from "@/utils/types";

interface RecommendationCardProps {
  recommendation: Recommendation;
}

const RecommendationCard: React.FC<RecommendationCardProps> = ({ recommendation }) => (
  <Paper sx={(theme) => ({ p: 3, borderColor: theme.palette.primary.main })}>
    <Stack spacing={1.5}>
      <Box>
        <Typography variant="h3" color="primary" gutterBottom>
          Rendu conseillé pour cette photo
        </Typography>
        <Typography variant="h2">{recommendation.name}</Typography>
      </Box>
      <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
        {recommendation.reasons.map((reason) => (
          <Typography key={reason} component="li" variant="body2">
            {reason}
          </Typography>
        ))}
      </Box>
      {recommendation.alternative && (
        <Typography variant="body2" color="text.secondary">
          Alternative : {recommendation.alternative.name} — {recommendation.alternative.reason}
        </Typography>
      )}
    </Stack>
  </Paper>
);

export default RecommendationCard;
