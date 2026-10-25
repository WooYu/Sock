import type { SemanticStudy, StudyClaim } from './note-study-types'
import { NOTE_PRICE_CARDS, type NotePriceModelId } from '../research/note-price-models'

/** Normalize every existing claim into a research card without inventing missing definitions. */
export function priceRuleCardForClaim(study: SemanticStudy, claim: StudyClaim) {
  const matches = NOTE_PRICE_CARDS.filter(card => card.source.sourceHash === study.sourceHash && card.source.file === study.file
    && (card.source.recordId === claim.claimId || card.source.evidence.some(source => {
      const quote = source.quote.replace(/^\s*-\s*/, '')
      return quote.length >= 12 && claim.evidence.some(evidence => evidence.startLine <= source.startLine && evidence.endLine >= source.endLine && evidence.quote.includes(quote))
    })))
  return {
    id: claim.claimId, sourceHash: study.sourceHash, file: study.file, evidence: claim.evidence,
    name: claim.name, inputs: claim.inputs, applicability: claim.applicability, invalidation: claim.invalidation,
    formula: claim.formula, gaps: [...claim.gaps], sourceComputability: claim.computability,
    stage: matches.length ? 'shadow' as const : claim.computability === 'reference' ? 'reference' as const : 'candidate' as const,
    executableModelIds: matches.map(card => card.id) as NotePriceModelId[],
    models: matches.map(card => ({ id: card.id, name: card.name, role: card.role, formula: card.formula,
      definition: card.researchDefinition, invalidation: card.invalidation, validation: card.validation })),
    missingForExecution: matches.length ? [] : ['尚未绑定经过版本管理的价格目标、时间映射及执行算法'],
  }
}
