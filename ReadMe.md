# GEO Format Benchmark

## Forschungsfrage

Werden Webinhalte, die als strukturierte Daten (JSON-LD, Markdown) aufbereitet sind, von Large Language Models häufiger zitiert als identische Inhalte in unstrukturiertem HTML — und beeinflusst die Position im Context das Ergebnis?

Basierend auf: *"CORE: Controlling Output Rankings in Generative Engines for LLM-based Search"* (Jin et al., Feb 2026, arXiv:2602.03608)

---

## Überblick

Eine Webanwendung, die es dem Nutzer erlaubt, eine Google-Suche einzugeben. Die Anwendung fetcht automatisch die Top-5-Ergebnisse, wandelt jeden Inhalt in vier verschiedene Formate um und führt ein kontrolliertes Experiment durch. Dieselbe Frage wird mehrfach an LLMs gestellt, wobei sowohl das Format als auch die Reihenfolge der Quellen im Context systematisch rotiert werden. Die Ergebnisse werden in einem Dashboard visualisiert.

---

## Ablauf

### 1. Nutzereingabe

Der Nutzer gibt eine Suchanfrage ein, z.B. *"best CRM for startups"*.

### 2. SERP Fetch

Die Anwendung ruft die Top-5 Google-Ergebnisse ab. Für jedes Ergebnis wird gespeichert:

- URL
- Seitentitel
- Meta-Description
- Vollständiger HTML-Content der Seite

### 3. Format-Konvertierung

Jeder der 5 Seiteninhalte wird in vier Formate umgewandelt. Der **Inhalt bleibt identisch** — nur die Präsentation ändert sich:

| Format | Beschreibung | Beispiel |
|--------|-------------|----------|
| **Raw HTML** | Vollständiger HTML-Quelltext wie vom Server geliefert — inklusive Navigation, Footer, Script-Tags, Ads-Container | `<div class="nav">...</div><main><h1>Best CRMs</h1>...` |
| **Clean HTML** | Nur der Hauptinhalt mit semantischen Tags, ohne Boilerplate | `<h1>Best CRMs</h1><p>HubSpot is...</p><ul>...` |
| **Markdown** | Strukturierter Fließtext mit Überschriften, Listen, Hervorhebungen | `# Best CRMs\n\nHubSpot is...\n\n- Free tier...` |
| **JSON-LD** | Schema.org-strukturierte Daten mit expliziten Feldern | `{"@type": "Article", "name": "...", "description": "...", "mentions": [...]}` |

### 4. Experiment-Design

Das Experiment kontrolliert zwei Variablen:

**Variable A — Format:** Welches Format hat eine Quelle, wenn sie dem LLM als Context übergeben wird?

**Variable B — Position:** An welcher Stelle im Context steht eine Quelle? (Position 1 = zuerst, Position 5 = zuletzt)

#### Rotation Format

Pro Query werden 5 Quellen mitgegeben. In jedem Run hat **eine** Quelle ein abweichendes Format (die "Testquelle"), die restlichen vier erhalten ein einheitliches Baseline-Format (Clean HTML).

| Run | Source 1 | Source 2 | Source 3 | Source 4 | Source 5 |
|-----|----------|----------|----------|----------|----------|
| 1   | **JSON-LD** | Clean HTML | Clean HTML | Clean HTML | Clean HTML |
| 2   | Clean HTML | **JSON-LD** | Clean HTML | Clean HTML | Clean HTML |
| 3   | Clean HTML | Clean HTML | **JSON-LD** | Clean HTML | Clean HTML |
| 4   | Clean HTML | Clean HTML | Clean HTML | **JSON-LD** | Clean HTML |
| 5   | Clean HTML | Clean HTML | Clean HTML | Clean HTML | **JSON-LD** |
| 6   | **Markdown** | Clean HTML | Clean HTML | Clean HTML | Clean HTML |
| ... | ... | ... | ... | ... | ... |
| 15  | Clean HTML | Clean HTML | Clean HTML | Clean HTML | **Raw HTML** |

Das ergibt pro Query: 5 Quellen × 3 Testformate (JSON-LD, Markdown, Raw HTML) = **15 Runs**.

#### Rotation Position

Zusätzlich wird die Reihenfolge der Quellen im Context rotiert, um den Position Bias von LLMs zu kontrollieren. Jede Quelle erscheint auf jeder Position gleich oft.

Für jede Format-Konfiguration werden **5 Permutationen** der Quellreihenfolge durchgeführt (Latin-Square-Design), sodass jede Quelle genau einmal an jeder Position steht.

| Permutation | Pos 1 | Pos 2 | Pos 3 | Pos 4 | Pos 5 |
|-------------|-------|-------|-------|-------|-------|
| A           | S1    | S2    | S3    | S4    | S5    |
| B           | S2    | S3    | S4    | S5    | S1    |
| C           | S3    | S4    | S5    | S1    | S2    |
| D           | S4    | S5    | S1    | S2    | S3    |
| E           | S5    | S1    | S2    | S3    | S4    |

#### Gesamtzahl API-Calls pro Query

- 15 Format-Runs × 5 Positionsrotationen = **75 Runs pro Query**
- × 3 LLMs (GPT-4o-mini, Gemini Flash, Claude Haiku) = **225 Calls pro Query**

### 5. Prompt-Template

```
You are a product advisor. Based ONLY on the following 5 sources,
recommend the best option for: "{user_query}"

Rules:
- Cite sources by their [Source N] tag when making claims
- Rank your top 3 recommendations
- Explain why you chose each one

{sources_block}

Provide your recommendations:
```

Wobei `{sources_block}` die 5 Quellen in der jeweiligen Reihenfolge und dem jeweiligen Format enthält:

```
=== Source 1 ({url}) ===
{content_in_assigned_format}

=== Source 2 ({url}) ===
{content_in_assigned_format}

...
```

### 6. Response-Parsing

Aus jeder LLM-Antwort werden extrahiert:

- **Zitierte Quellen:** Welche Source-Tags werden referenziert?
- **Zitations-Position:** An welcher Stelle der Empfehlung wird eine Quelle genannt? (1. Empfehlung = höchster Rank)
- **Zitations-Kontext:** Wird die Quelle positiv, neutral oder negativ erwähnt?
- **Rohantwort:** Vollständiger LLM-Output zur manuellen Überprüfung

### 7. Metriken

| Metrik | Beschreibung |
|--------|-------------|
| **Citation Rate** | Wie oft wird eine Quelle zitiert, aufgeschlüsselt nach Format? (z.B. JSON-LD: 78%, Markdown: 65%, Clean HTML: 52%, Raw HTML: 31%) |
| **Mean Citation Position** | Durchschnittliche Position in der Empfehlungsliste, wenn zitiert |
| **Position Bias Score** | Korrelation zwischen Context-Position und Citation-Wahrscheinlichkeit |
| **Format Lift** | Relative Veränderung der Citation Rate gegenüber der Clean-HTML-Baseline |
| **Cross-LLM Consistency** | Zeigen verschiedene LLMs denselben Format-Bias? |

### 8. Dashboard

Ein React-Frontend zeigt:

- **Experiment-Konfiguration:** Query eingeben, LLMs auswählen, Rotation starten
- **Live-Fortschritt:** Welche Runs laufen gerade, welche sind abgeschlossen?
- **Ergebnis-Übersicht:** Citation Rate pro Format als Balkendiagramm
- **Position-Bias-Heatmap:** Matrix aus Context-Position × Citation-Wahrscheinlichkeit
- **Detail-Ansicht:** Einzelne LLM-Antworten mit markierten Zitationen
- **Export:** Ergebnisse als CSV für weitere Analyse


---

## Ergebnisse

Erste Ergebnisse aus kontrollierten Experimenten mit zwei Suchanfragen ("best CRM for startups", "Besten Deutschen Fahrrad Onlineshops"), jeweils 225 Runs (15 Format-Konfigurationen x 5 Positionsrotationen x 3 LLMs).

### Citation Rate nach Format

| Format | Citation Rate | Format Lift vs. Clean HTML |
|--------|:------------:|:--------------------------:|
| **JSON-LD** | **72-80%** | **+16% bis +32%** |
| Markdown | 60-77% | -5% bis +11% |
| Clean HTML (Baseline) | 57-69% | 0% (Baseline) |
| Raw HTML | 40-60% | -42% bis +5% |

**Kernbefund:** JSON-LD-formatierte Inhalte werden konsistent haufiger von LLMs zitiert als identische Inhalte in anderen Formaten. Der Lift gegenuber der Clean-HTML-Baseline betragt +16-32%.

### Position Bias

| Metrik | Wert | Interpretation |
|--------|:----:|----------------|
| Pearson-Korrelation | 0.54-0.67 | Moderater bis starker Primacy Bias |

Quellen, die fruher im Context erscheinen, werden haufiger zitiert. Dies bestatigt die Notwendigkeit der Positionsrotation im Experiment-Design.

### Cross-LLM Vergleich

| LLM | JSON-LD | Markdown | Raw HTML |
|-----|:-------:|:--------:|:--------:|
| **GPT-4o-mini** | 72-76% | 60% | 48-62% |
| **Claude Haiku** | 56-88% | 72-78% | 0% |

- OpenAI bevorzugt JSON-LD deutlich gegenuber Markdown
- Anthropic zeigt eine hohere Varianz, bevorzugt aber ebenfalls strukturierte Formate
- Raw HTML schneidet bei allen LLMs am schlechtesten ab — bei Claude Haiku wurde es gar nicht zitiert (Content zu gross/unstrukturiert)

### Implikationen fur GEO

1. **Strukturierte Daten lohnen sich.** JSON-LD bietet den grossten Vorteil fur die Sichtbarkeit in LLM-generierten Antworten.
2. **Position matters.** Unternehmen sollten nicht nur das Format optimieren, sondern auch anstreben, in SERP-Ergebnissen moglichst weit oben zu erscheinen.
3. **LLMs reagieren unterschiedlich.** Eine GEO-Strategie sollte mehrere Modelle berucksichtigen.
4. **Raw HTML ist kontraproduktiv.** Unstrukturierte Webseiten werden signifikant seltener zitiert.

---

## Projektstruktur

```
geo-format-benchmark/
├── docker-compose.yml
├── Dockerfile
├── .github/
│   └── workflows/
│       └── ci.yml
├── README.md
├── tsconfig.json
├── package.json
├── src/
│   ├── index.ts                         # Express-Einstiegspunkt
│   ├── config.ts                        # API-Keys, DB-Connection, Env-Variablen
│   ├── pipeline/
│   │   ├── serp-fetcher.ts              # Google-Ergebnisse via Serper.dev abrufen
│   │   ├── html-extractor.ts            # Webseiten-Content fetchen (cheerio + readability)
│   │   ├── format-converter.ts          # HTML → Clean HTML / Markdown / JSON-LD
│   │   ├── experiment-runner.ts         # Rotation-Logik, Cloud Tasks dispatchen
│   │   └── llm-client.ts               # Einheitlicher Client für OpenAI/Gemini/Claude/Perplexity
│   ├── analysis/
│   │   ├── response-parser.ts           # Zitationen aus LLM-Antworten extrahieren
│   │   └── metrics.ts                   # Citation Rate, Position Bias berechnen
│   ├── models/
│   │   ├── db.ts                        # PostgreSQL-Client (pg + Drizzle ORM)
│   │   ├── firestore.ts                 # Firestore-Client für Live-Status
│   │   └── types.ts                     # TypeScript-Interfaces und Zod-Schemas
│   ├── routes/
│   │   ├── experiments.ts               # REST-Endpunkte: Experiment starten, Status, Ergebnisse
│   │   └── queries.ts                   # REST-Endpunkte: Queries verwalten
│   └── __tests__/
│       ├── format-converter.test.ts
│       ├── experiment-runner.test.ts
│       ├── response-parser.test.ts
│       └── metrics.test.ts
├── frontend/
│   ├── package.json
│   ├── tailwind.config.ts
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── ui/                      # shadcn/ui Komponenten
│   │   │   ├── QueryInput.tsx           # Suchanfrage eingeben
│   │   │   ├── ExperimentProgress.tsx   # Live-Status der Runs (Firestore-Listener)
│   │   │   ├── CitationChart.tsx        # Balkendiagramm Citation Rate (Recharts)
│   │   │   ├── PositionHeatmap.tsx      # Position Bias Visualisierung
│   │   │   └── ResponseDetail.tsx       # Einzelne Antworten inspizieren
│   │   ├── hooks/
│   │   │   └── useExperiment.ts         # React Query + Firestore Realtime
│   │   └── lib/
│   │       └── api-client.ts            # Typisierter API-Client
│   └── tsconfig.json
└── data/
    └── queries-example.json             # Beispiel-Queries zum Testen
```

---