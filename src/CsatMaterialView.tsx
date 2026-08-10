import type { ReactNode } from 'react'
import type { CsatMaterialSpec } from './types'

export function CsatMaterialView({ spec, renderText = (text) => text, collapseParagraphs = false }: { spec: CsatMaterialSpec; renderText?: (text: string) => ReactNode; collapseParagraphs?: boolean }) {
  if (spec.kind === 'chart') {
    const values = spec.series.flatMap((series) => series.values)
    const maximum = Math.max(1, ...values)
    return <figure className="csat-chart"><figcaption><strong>{spec.title || 'Chart'}</strong>{spec.unit && <small>Unit: {spec.unit}</small>}</figcaption><div className="chart-legend">{spec.series.map((series, index) => <span key={series.name}><i data-series={index % 3} />{series.name}</span>)}</div><div className="chart-grid">{spec.categories.map((category, categoryIndex) => <div className="chart-category" key={category}><div className="chart-bars">{spec.series.map((series, seriesIndex) => { const value = series.values[categoryIndex] ?? 0; return <span className="chart-bar" data-series={seriesIndex % 3} style={{ height: `${Math.max(4, value / maximum * 100)}%` }} title={`${series.name}: ${value}`} key={series.name}><b>{value}</b></span> })}</div><small>{category}</small></div>)}</div></figure>
  }
  if (spec.kind === 'practical') return <section className="csat-practical"><h4>{renderText(spec.heading || 'Information')}</h4><dl>{Object.entries(spec.fields).map(([key, value]) => <div key={key}><dt>{renderText(key)}</dt><dd>{renderText(value)}</dd></div>)}</dl>{spec.notes.length > 0 && <ul>{spec.notes.map((note) => <li key={note}>{renderText(note)}</li>)}</ul>}</section>
  if (spec.kind === 'ordered') return <section className="csat-ordered"><p className="given-block">{renderText(spec.lead)}</p>{spec.sections.map((section) => <div key={section.label}><strong>({section.label})</strong><p>{renderText(section.text)}</p></div>)}</section>
  if (spec.kind === 'insertion') return <section className="csat-insertion"><p className="given-block">{renderText(spec.givenSentence)}</p><p>{renderText(spec.body)}</p></section>
  if (spec.kind === 'summary') return <section className="csat-summary-box">{renderText(spec.summary)}</section>
  if (spec.kind === 'longNarrative') return <section className="csat-long-sections">{spec.sections.map((section) => <div key={section.label}><strong>({section.label})</strong><p>{renderText(section.text)}</p></div>)}</section>
  if (collapseParagraphs) return <section className="csat-prose-spec"><p>{renderText(spec.paragraphs.join(' '))}</p></section>
  return <section className="csat-prose-spec">{spec.paragraphs.map((paragraph, index) => <p key={index}>{renderText(paragraph)}</p>)}</section>
}
