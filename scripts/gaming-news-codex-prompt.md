Read `.gaming-news/candidates.json` and produce one daily gaming-news edition as JSON matching the supplied output schema.

Requirements:
- Select 5–8 genuinely important gaming stories from the supplied entries.
- Use only facts present in the candidate file. Do not browse, infer missing facts, or invent details.
- Exclude film, television, celebrity, shopping, guides, and general entertainment.
- Merge duplicate coverage of the same event.
- Rewrite every headline and summary from scratch in Norwegian Bokmål and English.
- Each summary must contain 2–3 compact factual sentences and at least 60 characters in each language.
- Do not add introductions, commentary, hype, filler, recommendations, or “why it matters”.
- Mark official announcements or independently corroborated reports as `confirmed`.
- Mark a report from one publication as `reported`.
- Mark unconfirmed speculation as `rumor`.
- Copy `sourceIds` exactly from the candidate entries used for each story.
- Return only the JSON object. Do not modify any repository files.
