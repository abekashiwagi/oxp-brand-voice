"use client";

import { useState, useMemo } from "react";
import { PageHeader } from "@/components/page-header";
import {
  useVoice,
  type PropertyOverride,
  type AgentVoiceTuning,
  type VerticalOverride,
  type NovaSonicSettings as NovaSonicSettingsType,
} from "@/lib/voice-context";
import { useAgents } from "@/lib/agents-context";
import { useVoiceV1_1 } from "@/lib/voice-v1-1-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  Building2, Layers, Home,
  ChevronRight, Plus, Pencil, X, Trash2,
  GraduationCap, Heart, Briefcase,
  RotateCcw,
  AudioLines, Play, Pause, Globe2, Mic, UserRound,
  MessageSquareQuote, Clock, ShieldCheck,
  CircleDot, FileText, Scale, ChevronDown,
} from "lucide-react";

/* ─── Constants ─── */

const VERTICALS = ["Conventional", "Student", "Affordable", "Commercial"] as const;

const VERTICAL_CONFIG: Record<string, { icon: typeof Building2; color: string; bgColor: string; description: string }> = {
  Conventional: { icon: Building2, color: "text-blue-600", bgColor: "bg-blue-50 dark:bg-blue-950/30", description: "Market-rate multifamily apartments" },
  Student: { icon: GraduationCap, color: "text-purple-600", bgColor: "bg-purple-50 dark:bg-purple-950/30", description: "University and college housing" },
  Affordable: { icon: Heart, color: "text-rose-600", bgColor: "bg-rose-50 dark:bg-rose-950/30", description: "Income-restricted housing communities" },
  Commercial: { icon: Briefcase, color: "text-amber-600", bgColor: "bg-amber-50 dark:bg-amber-950/30", description: "Office and retail properties" },
};

const MOCK_PROPERTIES = [
  { name: "Sunset Ridge Apartments", vertical: "Conventional", units: 240 },
  { name: "The Reserve at Millcreek", vertical: "Conventional", units: 180 },
  { name: "Parkside Lofts", vertical: "Conventional", units: 96 },
  { name: "University Commons", vertical: "Student", units: 320 },
  { name: "Campus Edge", vertical: "Student", units: 200 },
  { name: "Oakwood Terrace", vertical: "Affordable", units: 150 },
  { name: "Heritage Place", vertical: "Affordable", units: 88 },
  { name: "Metro Business Center", vertical: "Commercial", units: 45 },
];

/* ─── AI Voice — property manager friendly catalog ─── */
// Internally backed by Amazon Nova 2 Sonic voice IDs, but exposed
// to operators as simple "gender + accent" choices.

type VoiceGender = "female" | "male";
type VoiceAccent = "american" | "british" | "australian" | "indian";
type VoicePace = "relaxed" | "natural" | "brisk";
type VoicePersonality = "friendly" | "professional" | "energetic";

const VOICE_PRESETS: Array<{
  gender: VoiceGender;
  accent: VoiceAccent;
  voiceId: NovaSonicSettingsType["voiceId"];
  label: string;
  blurb: string;
  multilingualCapable: boolean;
}> = [
  { gender: "female", accent: "american",   voiceId: "tiffany", label: "American — Female",   blurb: "Warm, approachable. The most common choice for US properties.", multilingualCapable: true  },
  { gender: "male",   accent: "american",   voiceId: "matthew", label: "American — Male",     blurb: "Confident and professional. Versatile for any conversation.", multilingualCapable: true  },
  { gender: "female", accent: "british",    voiceId: "amy",     label: "British — Female",    blurb: "Polished British accent. Great for upscale or boutique properties.", multilingualCapable: false },
  { gender: "female", accent: "australian", voiceId: "olivia",  label: "Australian — Female", blurb: "Friendly Australian accent — relaxed and approachable.", multilingualCapable: false },
  { gender: "female", accent: "indian",     voiceId: "kiara",   label: "Indian — Female",     blurb: "Indian-English accent. Comfortable in English and Hindi.", multilingualCapable: false },
  { gender: "male",   accent: "indian",     voiceId: "arjun",   label: "Indian — Male",       blurb: "Indian-English accent. Comfortable in English and Hindi.", multilingualCapable: false },
];

const ACCENT_OPTIONS: Array<{ id: VoiceAccent; label: string; sub: string }> = [
  { id: "american",   label: "American",   sub: "Standard US English" },
  { id: "british",    label: "British",    sub: "UK English" },
  { id: "australian", label: "Australian", sub: "AU English" },
  { id: "indian",     label: "Indian",     sub: "Indian English" },
];

const PACE_OPTIONS: Array<{ id: VoicePace; rate: number; label: string; sub: string }> = [
  { id: "relaxed", rate: 0.92, label: "Relaxed", sub: "Slower, calmer" },
  { id: "natural", rate: 1.00, label: "Natural", sub: "Default pace" },
  { id: "brisk",   rate: 1.08, label: "Brisk",   sub: "A bit faster" },
];

const PERSONALITY_OPTIONS: Array<{
  id: VoicePersonality;
  style: NovaSonicSettingsType["speakingStyle"];
  label: string;
  sub: string;
}> = [
  { id: "friendly",     style: "conversational", label: "Friendly",     sub: "Warm and casual"  },
  { id: "professional", style: "generative",     label: "Professional", sub: "Polished default" },
  { id: "energetic",    style: "expressive",     label: "Energetic",    sub: "Lively and animated" },
];

/* Conversation behavior — maps to Nova `endpointingSensitivity` */
const RESPONSE_SPEED_OPTIONS: Array<{
  id: NovaSonicSettingsType["responseSpeed"];
  label: string;
  sub: string;
}> = [
  { id: "snappy",   label: "Snappy",   sub: "Quick replies (~1.5s)" },
  { id: "balanced", label: "Balanced", sub: "Default (~1.75s)" },
  { id: "patient",  label: "Patient",  sub: "Wait longer (~2s)" },
];

/* Conversation style — maps to Nova `temperature` */
const CONVERSATION_STYLE_OPTIONS: Array<{
  id: NovaSonicSettingsType["conversationStyle"];
  label: string;
  sub: string;
}> = [
  { id: "scripted", label: "Consistent", sub: "Same answers every time" },
  { id: "balanced", label: "Balanced",   sub: "A little variety" },
  { id: "creative", label: "Natural",    sub: "More conversational variation" },
];

/** Recommended consent script — used as default and "Reset to recommended" target. */
const RECOMMENDED_LEGAL_DISCLOSURE =
  "This call is being recorded and transcribed for quality assurance and training purposes. " +
  "If you do not consent to recording, please press 9 or stay on the line to be connected to a live agent.";

/** Languages Nova 2 Sonic can understand and respond in (when using a polyglot voice). */
const SUPPORTED_LANGUAGES: Array<{ code: string; name: string; flag: string }> = [
  { code: "en", name: "English",    flag: "🇺🇸" },
  { code: "es", name: "Spanish",    flag: "🇪🇸" },
  { code: "fr", name: "French",     flag: "🇫🇷" },
  { code: "de", name: "German",     flag: "🇩🇪" },
  { code: "it", name: "Italian",    flag: "🇮🇹" },
  { code: "pt", name: "Portuguese", flag: "🇵🇹" },
  { code: "hi", name: "Hindi",      flag: "🇮🇳" },
];

function findPresetByVoiceId(id: NovaSonicSettingsType["voiceId"]) {
  return VOICE_PRESETS.find((p) => p.voiceId === id) ?? VOICE_PRESETS[0];
}

function findPreset(gender: VoiceGender, accent: VoiceAccent) {
  return VOICE_PRESETS.find((p) => p.gender === gender && p.accent === accent);
}

function rateToPace(rate: number): VoicePace {
  if (rate <= 0.95) return "relaxed";
  if (rate >= 1.05) return "brisk";
  return "natural";
}


/* ─── Main Page ─── */

export default function VoicePage() {
  const voice = useVoice();
  const { agents } = useAgents();
  const { isVoiceV1_1 } = useVoiceV1_1();
  const [activeTab, setActiveTab] = useState("company");
  const [editingVertical, setEditingVertical] = useState<string | null>(null);
  const [propertyDialogOpen, setPropertyDialogOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<string | null>(null);

  const autonomousAgents = useMemo(
    () => agents.filter((a) => a.type === "autonomous"),
    [agents],
  );

  const effectiveTab = isVoiceV1_1 ? "company" : activeTab;

  return (
    <>
      <PageHeader
        title="Voice & Brand"
        description="Define how your AI agents communicate — set the tone, personality, and brand guidelines at every level from company-wide defaults down to individual agents."
      />

          <CascadeVisual activeLevel={effectiveTab} onLevelClick={setActiveTab} v1_1={isVoiceV1_1} />

          <Tabs value={effectiveTab} onValueChange={setActiveTab}>
            {!isVoiceV1_1 && (
              <TabsList className="mb-6">
                <TabsTrigger value="company">Company Defaults</TabsTrigger>
                <TabsTrigger value="verticals">Verticals</TabsTrigger>
                <TabsTrigger value="properties">Properties</TabsTrigger>
                <TabsTrigger value="agents">Agent Tuning</TabsTrigger>
              </TabsList>
            )}

            {/* ── COMPANY DEFAULTS ── */}
            <TabsContent value="company" className="space-y-6">
              {!isVoiceV1_1 && (
              <>
              <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Brand Identity</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-foreground">AI Persona</label>
                      <input
                        type="text"
                        value={voice.persona}
                        onChange={(e) => voice.update({ persona: e.target.value })}
                        className="input-base"
                        placeholder="e.g. Helpful property assistant"
                      />
                      <p className="mt-1 text-xs text-muted-foreground">How your AI agents identify themselves in conversations.</p>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-foreground">Brand & Tone Guidelines</label>
                      <textarea
                        value={voice.brandingTone}
                        onChange={(e) => voice.update({ brandingTone: e.target.value })}
                        rows={6}
                        className="input-base resize-y"
                        placeholder="e.g. Professional and friendly. Always identify as an assistant for the property."
                      />
                      <p className="mt-1 text-xs text-muted-foreground">These guidelines apply as defaults across all agents and properties.</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Tone Profile</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <ToneSliders
                      formality={voice.toneFormality}
                      warmth={voice.toneWarmth}
                      urgency={voice.toneUrgency}
                      onChange={(key, value) => voice.update({ [key]: value })}
                    />
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm text-emerald-700 dark:text-emerald-400">Do</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {voice.doExamples.map((ex, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <span className="mt-0.5 text-emerald-600">&#10003;</span>
                          <input
                            type="text"
                            value={ex}
                            onChange={(e) => {
                              const next = [...voice.doExamples];
                              next[i] = e.target.value;
                              voice.update({ doExamples: next });
                            }}
                            className="input-base h-8 flex-1 text-sm"
                          />
                          <button type="button" onClick={() => voice.update({ doExamples: voice.doExamples.filter((_, j) => j !== i) })} className="text-muted-foreground hover:text-foreground">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                    <Button variant="ghost" size="sm" className="mt-2" onClick={() => voice.update({ doExamples: [...voice.doExamples, ""] })}>
                      <Plus className="h-3.5 w-3.5" /> Add
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm text-red-700 dark:text-red-400">Don&apos;t</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {voice.dontExamples.map((ex, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <span className="mt-0.5 text-red-600">&#10007;</span>
                          <input
                            type="text"
                            value={ex}
                            onChange={(e) => {
                              const next = [...voice.dontExamples];
                              next[i] = e.target.value;
                              voice.update({ dontExamples: next });
                            }}
                            className="input-base h-8 flex-1 text-sm"
                          />
                          <button type="button" onClick={() => voice.update({ dontExamples: voice.dontExamples.filter((_, j) => j !== i) })} className="text-muted-foreground hover:text-foreground">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                    <Button variant="ghost" size="sm" className="mt-2" onClick={() => voice.update({ dontExamples: [...voice.dontExamples, ""] })}>
                      <Plus className="h-3.5 w-3.5" /> Add
                    </Button>
                  </CardContent>
                </Card>
              </div>
              </>
              )}

              {isVoiceV1_1 && (
                <AIVoiceCard
                  settings={voice.novaSonic}
                  onUpdate={(updates) => voice.update({ novaSonic: { ...voice.novaSonic, ...updates } })}
                />
              )}
            </TabsContent>

            {/* ── VERTICALS ── */}
            <TabsContent value="verticals" className="space-y-6">
              <p className="text-sm text-muted-foreground">
                Customize voice and tone for different property types. Vertical-level settings override company defaults for all properties within that vertical.
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                {VERTICALS.map((v) => {
                  const config = VERTICAL_CONFIG[v];
                  const override = voice.verticalOverrides.find((o) => o.vertical === v);
                  const Icon = config.icon;
                  const propertyCount = MOCK_PROPERTIES.filter((p) => p.vertical === v).length;

                  return (
                    <Card key={v} className={cn("transition-colors", override?.enabled && "border-primary/30")}>
                      <CardContent className="py-5">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", config.bgColor)}>
                              <Icon className={cn("h-5 w-5", config.color)} />
                            </div>
                            <div>
                              <h3 className="text-sm font-semibold text-foreground">{v}</h3>
                              <p className="text-xs text-muted-foreground">{config.description}</p>
                              <p className="mt-1 text-[10px] text-muted-foreground">{propertyCount} {propertyCount === 1 ? "property" : "properties"}</p>
                            </div>
                          </div>
                          <Badge variant={override?.enabled ? "default" : "secondary"} className="text-[10px]">
                            {override?.enabled ? "Custom" : "Inherited"}
                          </Badge>
                        </div>

                        {override?.enabled ? (
                          <div className="mt-4 space-y-2 rounded-lg bg-muted/50 p-3">
                            <p className="text-xs">
                              <span className="font-medium text-foreground">Persona:</span>{" "}
                              <span className="text-muted-foreground">{override.persona || "—"}</span>
                            </p>
                            <p className="text-xs text-muted-foreground line-clamp-2">{override.brandingTone || "—"}</p>
                            <div className="flex gap-3 pt-1">
                              {[
                                { label: "Formality", value: override.toneFormality },
                                { label: "Warmth", value: override.toneWarmth },
                                { label: "Urgency", value: override.toneUrgency },
                              ].map(({ label, value }) => (
                                <span key={label} className="text-[10px] text-muted-foreground">
                                  {label}: <span className="font-medium text-foreground">{value ?? "—"}%</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <p className="mt-4 text-xs italic text-muted-foreground">
                            Inherits all settings from company defaults.
                          </p>
                        )}

                        <div className="mt-4 flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => setEditingVertical(v)}>
                            {override?.enabled ? (
                              <><Pencil className="h-3 w-3" /> Edit</>
                            ) : (
                              <><Plus className="h-3 w-3" /> Customize</>
                            )}
                          </Button>
                          {override?.enabled && (
                            <Button variant="ghost" size="sm" onClick={() => voice.resetVerticalOverride(v)}>
                              <RotateCcw className="h-3 w-3" /> Reset
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>

            {/* ── PROPERTIES ── */}
            <TabsContent value="properties" className="space-y-6">
              <div className="flex items-start justify-between gap-4">
                <p className="text-sm text-muted-foreground">
                  Override voice settings for individual properties. Properties without overrides inherit from their vertical or company defaults.
                </p>
                <Button size="sm" onClick={() => { setEditingProperty(null); setPropertyDialogOpen(true); }}>
                  <Plus className="h-3.5 w-3.5" /> Add override
                </Button>
              </div>

              <div className="overflow-x-auto">
                <table className="table-borderless w-full min-w-[600px]">
                  <thead>
                    <tr>
                      <th>Property</th>
                      <th>Vertical</th>
                      <th>Voice Source</th>
                      <th className="w-24">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {MOCK_PROPERTIES.map((prop) => {
                      const override = voice.propertyOverrides.find((o) => o.property === prop.name);
                      const verticalOverride = voice.verticalOverrides.find((v) => v.vertical === prop.vertical && v.enabled);
                      const source = override
                        ? "Custom"
                        : verticalOverride
                          ? `Vertical: ${prop.vertical}`
                          : "Company Default";
                      const config = VERTICAL_CONFIG[prop.vertical];

                      return (
                        <tr key={prop.name} className="table-row-hover">
                          <td>
                            <div>
                              <p className="text-sm font-medium text-foreground">{prop.name}</p>
                              <p className="text-[10px] text-muted-foreground">{prop.units} units</p>
                            </div>
                          </td>
                          <td>
                            <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium", config?.bgColor, config?.color)}>
                              {prop.vertical}
                            </span>
                          </td>
                          <td>
                            <span className={cn(
                              "inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium",
                              override ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                            )}>
                              {source}
                            </span>
                          </td>
                          <td>
                            <div className="flex gap-1">
                              {override ? (
                                <>
                                  <button type="button" onClick={() => { setEditingProperty(prop.name); setPropertyDialogOpen(true); }} className="text-muted-foreground hover:text-foreground">
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                  <button type="button" onClick={() => voice.removePropertyOverride(prop.name)} className="text-muted-foreground hover:text-red-600">
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </>
                              ) : (
                                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setEditingProperty(prop.name); setPropertyDialogOpen(true); }}>
                                  Customize
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {voice.propertyOverrides.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">Active Overrides</h3>
                  {voice.propertyOverrides.map((ov) => {
                    const config = ov.vertical ? VERTICAL_CONFIG[ov.vertical] : undefined;
                    return (
                      <Card key={ov.property} className="border-primary/20">
                        <CardContent className="py-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="text-sm font-semibold text-foreground">{ov.property}</h4>
                                {ov.vertical && config && (
                                  <span className={cn("rounded-full px-1.5 py-0.5 text-[9px] font-medium", config.bgColor, config.color)}>
                                    {ov.vertical}
                                  </span>
                                )}
                              </div>
                              {ov.persona && <p className="mt-0.5 text-xs text-muted-foreground">Persona: {ov.persona}</p>}
                            </div>
                            <div className="flex gap-1.5">
                              <Button variant="ghost" size="sm" onClick={() => { setEditingProperty(ov.property); setPropertyDialogOpen(true); }}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => voice.removePropertyOverride(ov.property)}>
                                <Trash2 className="h-3.5 w-3.5 text-red-600" />
                              </Button>
                            </div>
                          </div>
                          {ov.brandingTone && <p className="mt-2 text-sm text-muted-foreground">{ov.brandingTone}</p>}
                          {(ov.toneFormality !== undefined || ov.toneWarmth !== undefined || ov.toneUrgency !== undefined) && (
                            <div className="mt-2 flex gap-4">
                              {ov.toneFormality !== undefined && (
                                <span className="text-[10px] text-muted-foreground">Formality: <span className="font-medium text-foreground">{ov.toneFormality}%</span></span>
                              )}
                              {ov.toneWarmth !== undefined && (
                                <span className="text-[10px] text-muted-foreground">Warmth: <span className="font-medium text-foreground">{ov.toneWarmth}%</span></span>
                              )}
                              {ov.toneUrgency !== undefined && (
                                <span className="text-[10px] text-muted-foreground">Urgency: <span className="font-medium text-foreground">{ov.toneUrgency}%</span></span>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* ── AGENT TUNING ── */}
            <TabsContent value="agents" className="space-y-6">
              <p className="text-sm text-muted-foreground">
                Fine-tune how individual ELI+ agents communicate. Agent-level settings take the highest priority in the cascade, overriding company, vertical, and property defaults.
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                {voice.agentTuning.map((tuning) => {
                  const agent = autonomousAgents.find((a) => a.id === tuning.agentId);
                  return (
                    <AgentTuningCard
                      key={tuning.agentId}
                      tuning={tuning}
                      agentStatus={agent?.status}
                      onUpdate={(updates) => voice.updateAgentTuning(tuning.agentId, updates)}
                    />
                  );
                })}
              </div>
            </TabsContent>
          </Tabs>

          {/* Vertical Edit Dialog */}
          {editingVertical && (() => {
            const override = voice.verticalOverrides.find((v) => v.vertical === editingVertical);
            return (
              <VerticalEditDialog
                vertical={editingVertical}
                override={override ?? { vertical: editingVertical, enabled: false }}
                companyDefaults={{
                  persona: voice.persona,
                  brandingTone: voice.brandingTone,
                  toneFormality: voice.toneFormality,
                  toneWarmth: voice.toneWarmth,
                  toneUrgency: voice.toneUrgency,
                }}
                onClose={() => setEditingVertical(null)}
                onSave={(updates) => {
                  voice.updateVerticalOverride(editingVertical, { ...updates, enabled: true });
                  setEditingVertical(null);
                }}
              />
            );
          })()}

          {/* Property Override Dialog */}
          {propertyDialogOpen && (() => {
            const existing = editingProperty
              ? voice.propertyOverrides.find((o) => o.property === editingProperty)
              : undefined;
            return (
              <PropertyOverrideDialog
                override={existing}
                preselectedProperty={editingProperty}
                existingProperties={voice.propertyOverrides.map((o) => o.property)}
                onClose={() => { setPropertyDialogOpen(false); setEditingProperty(null); }}
                onSave={(data) => {
                  if (existing) {
                    voice.updatePropertyOverride(editingProperty!, data);
                  } else {
                    voice.addPropertyOverride(data as PropertyOverride);
                  }
                  setPropertyDialogOpen(false);
                  setEditingProperty(null);
                }}
              />
            );
          })()}
    </>
  );
}

/* ─── Cascade Visualization ─── */

function CascadeVisual({ activeLevel, onLevelClick, v1_1 }: { activeLevel: string; onLevelClick: (level: string) => void; v1_1?: boolean }) {
  const allLevels = [
    { id: "company", label: "Company", desc: "Portfolio defaults", icon: Building2 },
    { id: "verticals", label: "Vertical", desc: "By property type", icon: Layers },
    { id: "properties", label: "Property", desc: "Individual overrides", icon: Home },
    { id: "agents", label: "Agent", desc: "Per-agent tuning", icon: null },
  ];
  const levels = v1_1 ? allLevels.filter((l) => l.id === "company") : allLevels;

  return (
    <div className="mb-6 flex items-center gap-1 overflow-x-auto pb-1">
      {levels.map((level, i) => {
        const Icon = level.icon;
        const isActive = activeLevel === level.id;
        return (
          <div key={level.id} className="flex items-center">
            <button
              type="button"
              onClick={() => onLevelClick(level.id)}
              className={cn(
                "flex items-center gap-2.5 rounded-lg border px-4 py-2.5 transition-all",
                isActive
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border hover:border-primary/30 hover:bg-muted/50",
              )}
            >
              <div className={cn(
                "flex h-8 w-8 items-center justify-center rounded-md",
                isActive ? "bg-primary/10" : "bg-muted",
              )}>
                {level.id === "agents" ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src="/eli-cube.svg" alt="" width={18} height={18} className="shrink-0" />
                ) : Icon ? (
                  <Icon className={cn("h-4 w-4", isActive ? "text-primary" : "text-muted-foreground")} />
                ) : null}
              </div>
              <div className="text-left">
                <p className={cn("text-sm font-medium", isActive ? "text-primary" : "text-foreground")}>{level.label}</p>
                <p className="text-[10px] text-muted-foreground">{level.desc}</p>
              </div>
            </button>
            {i < levels.length - 1 && (
              <ChevronRight className="mx-1 h-4 w-4 shrink-0 text-muted-foreground/50" />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Tone Sliders (reusable) ─── */

function ToneSliders({
  formality,
  warmth,
  urgency,
  onChange,
  disabled,
}: {
  formality: number;
  warmth: number;
  urgency: number;
  onChange: (key: string, value: number) => void;
  disabled?: boolean;
}) {
  const sliders = [
    { key: "toneFormality", label: "Formality", value: formality, low: "Casual", high: "Formal" },
    { key: "toneWarmth", label: "Warmth", value: warmth, low: "Neutral", high: "Warm" },
    { key: "toneUrgency", label: "Urgency", value: urgency, low: "Relaxed", high: "Urgent" },
  ];

  return (
    <>
      {sliders.map(({ key, label, value, low, high }) => (
        <div key={key}>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">{label}</span>
            <span className="text-xs text-muted-foreground">{value}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={value}
            onChange={(e) => onChange(key, Number(e.target.value))}
            className="w-full accent-primary"
            disabled={disabled}
          />
          <div className="mt-0.5 flex justify-between text-[10px] text-muted-foreground">
            <span>{low}</span>
            <span>{high}</span>
          </div>
        </div>
      ))}
    </>
  );
}

/* ─── AI Voice — Property manager friendly settings ─── */

function AIVoiceCard({
  settings,
  onUpdate,
}: {
  settings: NovaSonicSettingsType;
  onUpdate: (updates: Partial<NovaSonicSettingsType>) => void;
}) {
  const [previewing, setPreviewing] = useState(false);
  const currentPreset = findPresetByVoiceId(settings.voiceId);
  const currentGender = currentPreset.gender;
  const currentAccent = currentPreset.accent;
  const currentPace = rateToPace(settings.speakingRate);
  const currentPersonality =
    PERSONALITY_OPTIONS.find((p) => p.style === settings.speakingStyle)?.id ?? "professional";

  // Accents that have a voice for the currently selected gender.
  const availableAccentsForGender = new Set(
    VOICE_PRESETS.filter((p) => p.gender === currentGender).map((p) => p.accent),
  );

  // Green when on, neutral when off — applied to every Switch in the card.
  const greenSwitch = "data-[state=checked]:bg-emerald-500 dark:data-[state=checked]:bg-emerald-500";

  const playSample = () => {
    if (previewing) {
      setPreviewing(false);
      return;
    }
    setPreviewing(true);
    window.setTimeout(() => setPreviewing(false), 2400);
  };

  const setGender = (gender: VoiceGender) => {
    if (gender === currentGender) return;
    // Try to keep the same accent; fall back to any available accent for that gender.
    const target =
      findPreset(gender, currentAccent) ??
      VOICE_PRESETS.find((p) => p.gender === gender) ??
      VOICE_PRESETS[0];
    onUpdate({
      voiceId: target.voiceId,
      // Polyglot just mirrors voice capability — no longer a separate user toggle.
      polyglot: target.multilingualCapable,
    });
  };

  const setAccent = (accent: VoiceAccent) => {
    if (accent === currentAccent) return;
    const target =
      findPreset(currentGender, accent) ??
      VOICE_PRESETS.find((p) => p.accent === accent) ??
      VOICE_PRESETS[0];
    onUpdate({
      voiceId: target.voiceId,
      polyglot: target.multilingualCapable,
    });
  };

  const setPace = (pace: VoicePace) => {
    const opt = PACE_OPTIONS.find((p) => p.id === pace);
    if (opt) onUpdate({ speakingRate: opt.rate });
  };

  const setPersonality = (id: VoicePersonality) => {
    const opt = PERSONALITY_OPTIONS.find((p) => p.id === id);
    if (opt) onUpdate({ speakingStyle: opt.style });
  };

  const isDefaultLegal = settings.legalDisclosure.trim() === RECOMMENDED_LEGAL_DISCLOSURE.trim();
  const recordingActive = settings.recordingEnabled || settings.transcriptionEnabled;

  return (
    <Card className="border-violet-200/60 bg-gradient-to-br from-violet-50/50 via-background to-background dark:border-violet-900/40 dark:from-violet-950/20">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 shadow-sm">
              <AudioLines className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-base">AI Voice</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                How your AI sounds when speaking with leads and residents on the phone.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              {settings.enabled ? "On" : "Off"}
            </span>
            <Switch
              checked={settings.enabled}
              onCheckedChange={(checked) => onUpdate({ enabled: checked })}
              aria-label="Enable AI voice"
              className={greenSwitch}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className={cn("space-y-8 pt-2", !settings.enabled && "pointer-events-none opacity-60")}>

        {/* ───────────── 1. How it sounds ───────────── */}
        <Section
          eyebrow="Step 1"
          title="How it sounds"
          description="Pick a voice and accent — that's it."
        >
          {/* Voice gender — large cards */}
          <div className="grid grid-cols-2 gap-3">
            {([
              { id: "female" as const, label: "Female",  sub: "Warm, approachable" },
              { id: "male"   as const, label: "Male",    sub: "Confident, professional" },
            ]).map((g) => {
              const active = currentGender === g.id;
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setGender(g.id)}
                  disabled={!settings.enabled}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border p-3 text-left transition-all",
                    active
                      ? "border-violet-400 bg-background ring-2 ring-violet-200 dark:ring-violet-900/60"
                      : "border-border bg-background/40 hover:border-violet-200 hover:bg-background",
                  )}
                >
                  <div className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                    g.id === "female"
                      ? "bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300"
                      : "bg-sky-100 text-sky-600 dark:bg-sky-950/40 dark:text-sky-300",
                  )}>
                    <UserRound className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{g.label}</p>
                    <p className="text-xs text-muted-foreground">{g.sub}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Accent chips */}
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">Accent</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {ACCENT_OPTIONS.map((a) => {
                const active = currentAccent === a.id;
                const supported = availableAccentsForGender.has(a.id);
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => supported && setAccent(a.id)}
                    disabled={!settings.enabled || !supported}
                    title={supported ? undefined : `Not available for ${currentGender} voice`}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-left transition-all",
                      active && supported
                        ? "border-violet-400 bg-background ring-2 ring-violet-200 dark:ring-violet-900/60"
                        : supported
                          ? "border-border bg-background/40 hover:border-violet-200 hover:bg-background"
                          : "border-dashed border-border/60 bg-muted/30 text-muted-foreground/60",
                    )}
                  >
                    <p className="text-sm font-semibold text-foreground">{a.label}</p>
                    <p className="text-[10px] text-muted-foreground">{a.sub}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Live preview */}
          <div className="flex items-center justify-between gap-3 rounded-lg border border-violet-200/70 bg-background/70 p-3 dark:border-violet-900/40">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-200">
                <Mic className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{currentPreset.label}</p>
                <p className="text-xs text-muted-foreground">{currentPreset.blurb}</p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={playSample}
              disabled={!settings.enabled}
              className="h-9 shrink-0 gap-1.5"
            >
              {previewing ? (
                <>
                  <Pause className="h-3.5 w-3.5" />
                  <span className="inline-flex items-center gap-1">
                    Playing
                    <span className="ml-0.5 inline-flex items-end gap-[2px]" aria-hidden>
                      <span className="block h-2 w-[2px] animate-pulse rounded-sm bg-violet-500" style={{ animationDelay: "0ms" }} />
                      <span className="block h-3 w-[2px] animate-pulse rounded-sm bg-violet-500" style={{ animationDelay: "120ms" }} />
                      <span className="block h-2 w-[2px] animate-pulse rounded-sm bg-violet-500" style={{ animationDelay: "240ms" }} />
                    </span>
                  </span>
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5" />
                  Listen to a sample
                </>
              )}
            </Button>
          </div>
        </Section>

        {/* ───────────── 2. How it talks ───────────── */}
        <Section
          eyebrow="Step 2"
          title="How it talks"
          description="Personality, pace, and how patient it is on the phone."
        >
          <ChipGroup
            label="Personality"
            options={PERSONALITY_OPTIONS}
            value={currentPersonality}
            onChange={setPersonality}
            disabled={!settings.enabled}
          />
          <ChipGroup
            label="Speaking pace"
            options={PACE_OPTIONS}
            value={currentPace}
            onChange={setPace}
            disabled={!settings.enabled}
          />
          <ChipGroup
            label="Response speed"
            help="How long to wait when a caller pauses."
            options={RESPONSE_SPEED_OPTIONS}
            value={settings.responseSpeed}
            onChange={(id) => onUpdate({ responseSpeed: id })}
            disabled={!settings.enabled}
          />
          <ChipGroup
            label="Answer variety"
            help="Same wording every time vs. natural variation."
            options={CONVERSATION_STYLE_OPTIONS}
            value={settings.conversationStyle}
            onChange={(id) => onUpdate({ conversationStyle: id })}
            disabled={!settings.enabled}
          />
        </Section>

        {/* ───────────── 3. Languages ───────────── */}
        <Section
          eyebrow="Step 3"
          title="Languages"
          description="Which languages your AI understands and can reply in."
        >
          <SupportedLanguagesPanel multilingualCapable={currentPreset.multilingualCapable} />
        </Section>

        {/* ───────────── 4. Recording, transcripts & legal ───────────── */}
        <Section
          eyebrow="Step 4"
          title="Recording, transcripts & legal"
          description="Capture calls for QA — and stay compliant automatically."
        >
          <ToggleRow
            icon={<CircleDot className={cn("h-3.5 w-3.5", settings.recordingEnabled && "text-rose-600")} />}
            iconClass={cn(
              "bg-rose-100/70 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
              settings.recordingEnabled && "ring-2 ring-rose-200 dark:ring-rose-900/60",
            )}
            title="Record audio"
            description="Save call audio for quality assurance, training, and dispute resolution."
            checked={settings.recordingEnabled}
            onChange={(v) => onUpdate({ recordingEnabled: v })}
            disabled={!settings.enabled}
            switchClass={greenSwitch}
          />
          <ToggleRow
            icon={<FileText className="h-3.5 w-3.5" />}
            iconClass="bg-sky-100/70 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300"
            title="Generate transcripts"
            description="Searchable text transcripts of every call, attached to the lead/resident profile."
            checked={settings.transcriptionEnabled}
            onChange={(v) => onUpdate({ transcriptionEnabled: v })}
            disabled={!settings.enabled}
            switchClass={greenSwitch}
          />

          {/* Auto-played legal disclosure — appears as a "live banner" when recording is on */}
          {recordingActive ? (
            <div className="rounded-lg border border-emerald-300/60 bg-emerald-50/60 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
              <div className="mb-2 flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                    <Scale className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Played automatically before every call connects
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Two-party consent compliance for CA, CT, FL, IL, MA, MD, MT, NH, PA, WA, and others.
                    </p>
                  </div>
                </div>
                {!isDefaultLegal && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onUpdate({ legalDisclosure: RECOMMENDED_LEGAL_DISCLOSURE })}
                    className="h-7 shrink-0 gap-1 text-xs"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Reset
                  </Button>
                )}
              </div>
              <textarea
                value={settings.legalDisclosure}
                onChange={(e) => onUpdate({ legalDisclosure: e.target.value })}
                disabled={!settings.enabled}
                rows={3}
                maxLength={500}
                className={cn(
                  "w-full resize-none rounded-md border border-emerald-300/60 bg-background px-3 py-2 text-sm shadow-sm",
                  "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-400",
                  "disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-900/40",
                )}
              />
              <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <CircleDot className="h-2.5 w-2.5 text-rose-500" />
                  Auto-played in the AI voice you selected above
                </span>
                <span>{settings.legalDisclosure.length}/500</span>
              </div>
            </div>
          ) : (
            <p className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              Turn on recording or transcripts above to configure the legal disclosure played before each call.
            </p>
          )}
        </Section>

        {/* ───────────── 5. Advanced (collapsible) ───────────── */}
        <details className="group rounded-lg border border-dashed border-border bg-background/40">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-medium text-foreground select-none">
            <span className="flex items-center gap-2">
              <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
              Advanced — greeting, hold phrase, and call limits
            </span>
            <span className="text-[10px] font-normal text-muted-foreground">Most operators leave these alone</span>
          </summary>
          <div className="space-y-4 border-t border-border/60 px-4 py-4">
            <div>
              <label htmlFor="greeting" className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-foreground">
                <MessageSquareQuote className="h-3.5 w-3.5 text-muted-foreground" />
                Greeting (first thing the AI says)
              </label>
              <textarea
                id="greeting"
                value={settings.greeting}
                onChange={(e) => onUpdate({ greeting: e.target.value })}
                disabled={!settings.enabled}
                rows={2}
                maxLength={240}
                className={cn(
                  "w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm",
                  "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                )}
                placeholder="Thank you for calling {property}. How can I help?"
              />
              <p className="mt-1 text-[10px] text-muted-foreground">
                Use <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">{"{property}"}</code> to insert the property name automatically.
              </p>
            </div>

            <div>
              <label htmlFor="hold" className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-foreground">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                Hold phrase (when the AI is looking something up)
              </label>
              <input
                id="hold"
                type="text"
                value={settings.holdPhrase}
                onChange={(e) => onUpdate({ holdPhrase: e.target.value })}
                disabled={!settings.enabled}
                maxLength={140}
                className={cn(
                  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm",
                  "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                )}
                placeholder="One moment while I pull that up for you."
              />
            </div>

            <div>
              <label htmlFor="maxlen" className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-foreground">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                Maximum call length: <span className="font-semibold text-foreground">{settings.maxCallMinutes} minutes</span>
              </label>
              <input
                id="maxlen"
                type="range"
                min={5}
                max={60}
                step={5}
                value={settings.maxCallMinutes}
                onChange={(e) => onUpdate({ maxCallMinutes: Number(e.target.value) })}
                disabled={!settings.enabled}
                className="w-full accent-violet-500"
              />
              <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                <span>5 min</span>
                <span>If a call runs long, the AI offers to transfer or schedule a callback.</span>
                <span>60 min</span>
              </div>
            </div>

            <ToggleRow
              icon={<ShieldCheck className="h-3.5 w-3.5" />}
              iconClass="bg-violet-100/70 text-violet-700 dark:bg-violet-950/40 dark:text-violet-200"
              title="Disclose to callers that they're speaking with an AI"
              description="Adds a short AI disclosure on first call. Required by law in some states (e.g. CA, CO)."
              checked={settings.aiDisclosure}
              onChange={(v) => onUpdate({ aiDisclosure: v })}
              disabled={!settings.enabled}
              switchClass={greenSwitch}
            />
          </div>
        </details>
      </CardContent>
    </Card>
  );
}

/* ─── Tiny presentational helpers used inside AIVoiceCard ─── */

function Section({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline gap-2">
        <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700 dark:border-violet-900/40 dark:bg-violet-950/30 dark:text-violet-300">
          {eyebrow}
        </span>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
      <div className="space-y-3 pt-1">{children}</div>
    </section>
  );
}

type ChipOption<T extends string> = { id: T; label: string; sub: string };

function ChipGroup<T extends string>({
  label,
  help,
  options,
  value,
  onChange,
  disabled,
}: {
  label: string;
  help?: string;
  options: ReadonlyArray<ChipOption<T>>;
  value: T;
  onChange: (id: T) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <p className="text-xs font-medium text-foreground">{label}</p>
        {help && <p className="text-[10px] text-muted-foreground">{help}</p>}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {options.map((o) => {
          const active = value === o.id;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => onChange(o.id)}
              disabled={disabled}
              className={cn(
                "rounded-lg border px-3 py-2 text-left transition-all",
                active
                  ? "border-violet-400 bg-background ring-2 ring-violet-200 dark:ring-violet-900/60"
                  : "border-border bg-background/40 hover:border-violet-200 hover:bg-background",
              )}
            >
              <p className="text-sm font-semibold text-foreground">{o.label}</p>
              <p className="text-[10px] text-muted-foreground">{o.sub}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ToggleRow({
  icon,
  iconClass,
  title,
  description,
  checked,
  onChange,
  disabled,
  switchClass,
}: {
  icon: React.ReactNode;
  iconClass: string;
  title: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  switchClass?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-border bg-background/60 p-3.5">
      <div className="flex items-start gap-2.5">
        <div className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md", iconClass)}>
          {icon}
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        disabled={disabled}
        aria-label={title}
        className={switchClass}
      />
    </div>
  );
}

/**
 * Read-only panel showing the languages Nova 2 Sonic responds in when it detects them.
 * Only the polyglot voices (Tiffany / Matthew, both American) can do this; for other accents
 * we show the same list but muted with an explanation.
 */
function SupportedLanguagesPanel({ multilingualCapable }: { multilingualCapable: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-background/60 p-3.5">
      <div className="mb-3 flex items-start gap-2.5">
        <div
          className={cn(
            "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
            multilingualCapable
              ? "bg-violet-100/70 text-violet-700 dark:bg-violet-950/40 dark:text-violet-200"
              : "bg-muted text-muted-foreground",
          )}
        >
          <Globe2 className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">Speaks the caller&apos;s language automatically</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {multilingualCapable
              ? "If your caller speaks any of these languages, the AI will detect it and reply in that language — no setup required."
              : "Available with the American accent only — switch to Tiffany or Matthew to enable multilingual replies."}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {SUPPORTED_LANGUAGES.map((lang) => (
          <span
            key={lang.code}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium",
              multilingualCapable
                ? "border-violet-200/70 bg-violet-50/50 text-foreground dark:border-violet-900/40 dark:bg-violet-950/20"
                : "border-dashed border-border bg-muted/30 text-muted-foreground",
            )}
          >
            <span aria-hidden className="text-sm leading-none">{lang.flag}</span>
            {lang.name}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ─── Agent Tuning Card ─── */

function AgentTuningCard({
  tuning,
  agentStatus,
  onUpdate,
}: {
  tuning: AgentVoiceTuning;
  agentStatus?: string;
  onUpdate: (updates: Partial<AgentVoiceTuning>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [tone, setTone] = useState(tuning.toneOverride ?? "");
  const [personality, setPersonality] = useState(tuning.personality ?? "");
  const [instructions, setInstructions] = useState(tuning.customInstructions ?? "");
  const [responseLength, setResponseLength] = useState(tuning.responseLength ?? "standard");
  const [allowEmoji, setAllowEmoji] = useState(tuning.allowEmoji ?? false);

  const handleSave = () => {
    onUpdate({
      toneOverride: tone,
      personality,
      customInstructions: instructions,
      responseLength: responseLength as AgentVoiceTuning["responseLength"],
      allowEmoji,
    });
    setEditing(false);
  };

  const status = agentStatus || "Active";
  const isOff = status === "Off";
  const displayName = `ELI+ ${tuning.agentName}`;

  return (
    <Card className={cn(isOff && "opacity-70")}>
      <CardContent className="py-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/eli-cube.svg" alt="" width={22} height={22} className="shrink-0" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-foreground">{displayName}</h3>
                <span className={cn(
                  "rounded-full px-1.5 py-0.5 text-[9px] font-medium",
                  isOff ? "bg-muted text-muted-foreground" : "bg-[#B3FFCC] text-green-800",
                )}>
                  {status}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {tuning.toneOverride || "Using default tone"} · {tuning.responseLength ?? "standard"} responses
              </p>
            </div>
          </div>
          {!editing ? (
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
          ) : (
            <div className="flex gap-1.5">
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
              <Button size="sm" onClick={handleSave}>Save</Button>
            </div>
          )}
        </div>

        {!editing ? (
          <div className="mt-3 space-y-2 text-sm">
            {tuning.personality && (
              <p><span className="font-medium text-foreground">Personality:</span> <span className="text-muted-foreground">{tuning.personality}</span></p>
            )}
            {tuning.customInstructions && (
              <p><span className="font-medium text-foreground">Instructions:</span> <span className="text-muted-foreground">{tuning.customInstructions}</span></p>
            )}
            <div className="flex items-center gap-3">
              <span className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-medium",
                tuning.allowEmoji ? "bg-[#B3FFCC] text-black" : "bg-muted text-muted-foreground",
              )}>
                Emoji: {tuning.allowEmoji ? "On" : "Off"}
              </span>
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Tone override</label>
              <input type="text" value={tone} onChange={(e) => setTone(e.target.value)} className="input-base h-8 text-sm" placeholder="e.g. Enthusiastic and sales-oriented" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Personality</label>
              <input type="text" value={personality} onChange={(e) => setPersonality(e.target.value)} className="input-base h-8 text-sm" placeholder="e.g. Excited about helping people find their new home" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Custom instructions</label>
              <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={2} className="input-base resize-y text-sm" placeholder="e.g. Always mention current specials." />
            </div>
            <div className="flex items-center gap-6">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Response length</label>
                <select value={responseLength} onChange={(e) => setResponseLength(e.target.value as "concise" | "standard" | "detailed")} className="select-base h-8 text-sm">
                  <option value="concise">Concise</option>
                  <option value="standard">Standard</option>
                  <option value="detailed">Detailed</option>
                </select>
              </div>
              <label className="flex items-center gap-2 pt-4">
                <input type="checkbox" checked={allowEmoji} onChange={(e) => setAllowEmoji(e.target.checked)} className="h-4 w-4 rounded border-border" />
                <span className="text-sm text-foreground">Allow emoji</span>
              </label>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── Vertical Edit Dialog ─── */

function VerticalEditDialog({
  vertical,
  override,
  companyDefaults,
  onClose,
  onSave,
}: {
  vertical: string;
  override: VerticalOverride;
  companyDefaults: { persona: string; brandingTone: string; toneFormality: number; toneWarmth: number; toneUrgency: number };
  onClose: () => void;
  onSave: (updates: Partial<VerticalOverride>) => void;
}) {
  const [persona, setPersona] = useState(override.persona ?? companyDefaults.persona);
  const [brandingTone, setBrandingTone] = useState(override.brandingTone ?? companyDefaults.brandingTone);
  const [toneFormality, setToneFormality] = useState(override.toneFormality ?? companyDefaults.toneFormality);
  const [toneWarmth, setToneWarmth] = useState(override.toneWarmth ?? companyDefaults.toneWarmth);
  const [toneUrgency, setToneUrgency] = useState(override.toneUrgency ?? companyDefaults.toneUrgency);

  const config = VERTICAL_CONFIG[vertical];
  const Icon = config?.icon || Building2;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", config?.bgColor)}>
              <Icon className={cn("h-4 w-4", config?.color)} />
            </div>
            <div>
              <DialogTitle>Customize {vertical} Voice</DialogTitle>
              <DialogDescription>{config?.description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Persona</label>
            <input type="text" value={persona} onChange={(e) => setPersona(e.target.value)} className="input-base text-sm" placeholder="e.g. Friendly campus guide" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Brand & Tone Guidelines</label>
            <textarea value={brandingTone} onChange={(e) => setBrandingTone(e.target.value)} rows={3} className="input-base resize-y text-sm" />
          </div>
          <div className="rounded-lg border border-border p-4">
            <p className="mb-3 text-xs font-medium text-foreground">Tone Profile</p>
            <ToneSliders
              formality={toneFormality}
              warmth={toneWarmth}
              urgency={toneUrgency}
              onChange={(key, value) => {
                if (key === "toneFormality") setToneFormality(value);
                else if (key === "toneWarmth") setToneWarmth(value);
                else if (key === "toneUrgency") setToneUrgency(value);
              }}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave({ persona, brandingTone, toneFormality, toneWarmth, toneUrgency })}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Property Override Dialog ─── */

function PropertyOverrideDialog({
  override,
  preselectedProperty,
  existingProperties,
  onClose,
  onSave,
}: {
  override?: PropertyOverride;
  preselectedProperty?: string | null;
  existingProperties: string[];
  onClose: () => void;
  onSave: (data: PropertyOverride | Partial<PropertyOverride>) => void;
}) {
  const isEditing = !!override;
  const available = MOCK_PROPERTIES.filter((p) => !existingProperties.includes(p.name) || p.name === override?.property || p.name === preselectedProperty);
  const [property, setProperty] = useState(override?.property ?? preselectedProperty ?? available[0]?.name ?? "");
  const [persona, setPersona] = useState(override?.persona ?? "");
  const [brandingTone, setBrandingTone] = useState(override?.brandingTone ?? "");
  const [toneFormality, setToneFormality] = useState(override?.toneFormality ?? 65);
  const [toneWarmth, setToneWarmth] = useState(override?.toneWarmth ?? 75);
  const [toneUrgency, setToneUrgency] = useState(override?.toneUrgency ?? 40);

  const selectedProperty = MOCK_PROPERTIES.find((p) => p.name === property);

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? `Edit ${override.property}` : "Add Property Override"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Modify voice settings for this property."
              : "Customize voice settings for a specific property. This overrides vertical and company defaults."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!isEditing && (
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Property</label>
              <select value={property} onChange={(e) => setProperty(e.target.value)} className="select-base w-full text-sm">
                {available.map((p) => (
                  <option key={p.name} value={p.name}>{p.name} ({p.vertical})</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Persona override</label>
            <input type="text" value={persona} onChange={(e) => setPersona(e.target.value)} className="input-base text-sm" placeholder="e.g. Luxury concierge" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Brand & tone override</label>
            <textarea value={brandingTone} onChange={(e) => setBrandingTone(e.target.value)} rows={3} className="input-base resize-y text-sm" placeholder="e.g. Upscale and sophisticated." />
          </div>

          <div className="rounded-lg border border-border p-4">
            <p className="mb-3 text-xs font-medium text-foreground">Tone Profile</p>
            <ToneSliders
              formality={toneFormality}
              warmth={toneWarmth}
              urgency={toneUrgency}
              onChange={(key, value) => {
                if (key === "toneFormality") setToneFormality(value);
                else if (key === "toneWarmth") setToneWarmth(value);
                else if (key === "toneUrgency") setToneUrgency(value);
              }}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => onSave({
              property,
              vertical: selectedProperty?.vertical,
              persona: persona || undefined,
              brandingTone: brandingTone || undefined,
              toneFormality,
              toneWarmth,
              toneUrgency,
            })}
            disabled={!property}
          >
            {isEditing ? "Save" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
