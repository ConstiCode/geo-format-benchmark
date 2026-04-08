# GEO Format Benchmark

## Forschungsfrage

Werden Webinhalte, die als strukturierte Daten (JSON-LD, Markdown) aufbereitet sind, von Large Language Models häufiger zitiert als identische Inhalte in unstrukturiertem HTML — und beeinflusst die Position im Context das Ergebnis?

Basierend auf: *"CORE: Controlling Output Rankings in Generative Engines for LLM-based Search"* (Jin et al., Feb 2026, arXiv:2602.03608)

---

## Überblick

Eine Webanwendung, die es dem Nutzer erlaubt, eine Google-Suche einzugeben. Die Anwendung fetcht automatisch die Top-5-Ergebnisse, wandelt jeden Inhalt in vier verschiedene Formate um und führt ein kontrolliertes Experiment durch: Dieselbe Frage wird mehrfach an LLMs gestellt, wobei sowohl das Format als auch die Reihenfolge der Quellen im Context systematisch rotiert werden. Die Ergebnisse werden in einem Dashboard visualisiert.

---

## Ablauf

### 1. Nutzereingabe

Der Nutzer gibt eine Suchanfrage ein, z.B. *"best CRM for startups"*.

### 2. SERP Fetch

Die Anwendung ruft die Top-5 Google-Ergebnisse ab (via Serper.dev API, kostenloser Tier: 2.500 Abfragen). Für jedes Ergebnis wird gespeichert:

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

**Hinweis:** Für ein MVP kann die Positionsrotation auf 1 Permutation reduziert werden (15 Runs × 3 LLMs = 45 Calls pro Query). Die volle Rotation wird als Option angeboten.

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

## Tech Stack

Ausgewählt mit Blick auf GCP-native Architektur und TypeScript-First-Entwicklung.

| Komponente | Technologie | Begründung |
|-----------|------------|------------|
| Sprache | **TypeScript** (Backend + Frontend) | Einheitliche Sprache über den gesamten Stack, Typsicherheit end-to-end |
| Backend Framework | **Express.js** auf GCP Cloud Functions | Serverless, auto-scaling, kein Infra-Management |
| Task Queue | **GCP Cloud Tasks** | Asynchrone Orchestrierung der LLM-Experiment-Runs, Retry-Logik built-in |
| Datenbank | **PostgreSQL** (Cloud SQL) + **Firestore** | PostgreSQL für strukturierte Experiment-Daten und Relationen; Firestore für Live-Experiment-Status und schnelle Reads im Dashboard |
| Search/Analytics | **Elasticsearch** | Volltextsuche über LLM-Responses, Aggregationen für Metriken |
| LLM APIs | **OpenAI** (GPT-4o-mini), **Gemini** Flash, **Claude** Haiku, **Perplexity** | Vier Anbieter für breiten Vergleich, günstige Tiers |
| SERP API | **Serper.dev** | Kostenloser Tier (2.500 Queries), JSON-Response |
| HTML Parsing | **cheerio**, **@mozilla/readability** | Schnelles HTML-Parsing in Node.js, serverseitige Content-Extraktion |
| Frontend | **React**, **TypeScript**, **shadcn/ui**, **Tailwind CSS**, **Recharts** | Modernes UI-Toolkit, konsistent mit Peec AIs Frontend-Stack |
| Containerisierung | **Docker**, docker-compose | Reproduzierbare Umgebung, lokale Entwicklung mit GCP-Emulator |
| CI/CD | **GitHub Actions** | Automatische Tests, Linting, Type-Checking bei jedem Push |
| Tests | **Vitest**, **Supertest** | Schnelle Unit-/Integrationstests für TypeScript |

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

## Kostenabschätzung

| Posten | Berechnung | Kosten |
|--------|-----------|--------|
| Serper.dev | Kostenloser Tier: 2.500 Queries | $0 |
| GPT-4o-mini | ~75 Calls × ~2K Tokens = 150K Tokens | ~$0.02 |
| Gemini Flash | ~75 Calls, kostenloser Tier | $0 |
| Claude Haiku | ~75 Calls × ~2K Tokens = 150K Tokens | ~$0.04 |
| Perplexity Sonar | ~75 Calls (pay-per-use) | ~$0.04 |
| **Gesamt pro Query** | | **< $0.15** |
| **10 Queries (MVP)** | | **< $1.50** |

---

## MVP-Scope (Woche 1–2)

1. Backend (TypeScript/Express): SERP Fetch → HTML Extract → Format Convert → LLM Runner (nur Format-Rotation, eine Permutation)
2. Response Parser + Metriken-Berechnung
3. Frontend (React/shadcn/Tailwind): Query-Eingabe + Ergebnis-Tabelle + Citation-Chart
4. PostgreSQL-Schema, Firestore für Live-Status
5. Docker-Setup, 5+ Unit-Tests (Vitest), CI-Pipeline mit Type-Checking
6. README mit Setup-Anleitung, Architekturdiagramm, Beispiel-Output

## Erweiterungen (Woche 3+)

- Volle Positionsrotation (Latin-Square)
- Statistische Signifikanztests (Chi-Squared, Bootstrap)
- Weitere Formate testen (XML, YAML, Tabellen)
- Prompt-Variationen als zusätzliche Variable
- Vergleich mit tatsächlichem Perplexity/ChatGPT-Browsing-Verhalten