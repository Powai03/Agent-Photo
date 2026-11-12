"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Rating from "@mui/material/Rating";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Typography from "@mui/material/Typography";
import { useCallback, useEffect, useMemo, useState } from "react";
import LookPreview from "@/components/LookPreview";
import SettingSections from "@/components/SettingSections";
import { buildIphoneSections, buildLightroomSections, sectionsToText } from "@/utils/settingSections";
import type { LookProposal } from "@/utils/types";

const COPIED_FEEDBACK_MS = 2000;

type EditorTab = "iphone" | "lightroom";

interface LookCardProps {
  look: LookProposal;
  previewSource: ImageData;
  beforeUrl: string;
}

interface NoteListProps {
  title: string;
  notes: string[];
}

const NoteList: React.FC<NoteListProps> = ({ title, notes }) => (
  <Box>
    <Typography variant="h3" gutterBottom>
      {title}
    </Typography>
    <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
      {notes.map((note) => (
        <Typography key={note} component="li" variant="body2" color="text.secondary">
          {note}
        </Typography>
      ))}
    </Box>
  </Box>
);

const LookCard: React.FC<LookCardProps> = ({ look, previewSource, beforeUrl }) => {
  const [activeTab, setActiveTab] = useState<EditorTab>("iphone");
  const [isCopied, setIsCopied] = useState(false);

  const sections = useMemo(
    () =>
      activeTab === "iphone"
        ? buildIphoneSections(look.iphone)
        : buildLightroomSections(look.lightroom),
    [activeTab, look],
  );

  useEffect(() => {
    if (!isCopied) return undefined;
    const timeoutId = setTimeout(() => setIsCopied(false), COPIED_FEEDBACK_MS);
    return () => clearTimeout(timeoutId);
  }, [isCopied]);

  const handleTabChange = useCallback((_event: React.SyntheticEvent, tab: EditorTab) => {
    setActiveTab(tab);
  }, []);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(sectionsToText(look.name, sections));
    setIsCopied(true);
  }, [look.name, sections]);

  return (
    <Paper sx={{ p: 3 }}>
      <Stack spacing={2}>
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
              <Typography variant="h2">{look.name}</Typography>
              {look.isRecommended && <Chip label="Conseillé" color="primary" size="small" />}
            </Box>
            <Rating value={look.fitScore} readOnly size="small" />
          </Box>
          <Typography variant="body2" color="text.secondary">
            {look.family}
          </Typography>
        </Box>
        <LookPreview source={previewSource} beforeUrl={beforeUrl} settings={look.lightroom} />
        <Typography variant="body2">{look.description}</Typography>
        {look.strengths.length > 0 && <NoteList title="Pourquoi il fonctionne ici" notes={look.strengths} />}
        {look.cautions.length > 0 && <NoteList title="Points de vigilance" notes={look.cautions} />}
        {look.adaptations.length > 0 && <NoteList title="Ajusté pour cette photo" notes={look.adaptations} />}
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
          <Tabs value={activeTab} onChange={handleTabChange}>
            <Tab value="iphone" label="iPhone" />
            <Tab value="lightroom" label="Lightroom" />
          </Tabs>
          <Button size="small" onClick={handleCopy}>
            {isCopied ? "Copié" : "Copier"}
          </Button>
        </Box>
        <SettingSections sections={sections} />
      </Stack>
    </Paper>
  );
};

export default LookCard;
