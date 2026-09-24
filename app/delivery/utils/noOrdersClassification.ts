/**
 * Competitor-Aware No-Orders Block Classification & Analysis Engine (Phase 4)
 *
 * ARCHITECTURAL RATIONALE:
 * Service area validation must ALWAYS precede competitor counting.
 * A block beyond branch delivery range must NEVER be classified as contested,
 * white-space, or saturated.
 *
 * Directing marketing budget or promotional flyers to out-of-range blocks
 * generates customer orders that fail delivery SLAs, require manual cancellations,
 * and harm customer trust.
 *
 * Therefore, any block outside delivery radius is routed exclusively to
 * network expansion planning, never to marketing campaigns.
 */

import {
  BranchDeliveryProfile,
  CompetitorPharmacy,
  DeliveryBlockMetric,
  Governorate,
  NoOrderBlockAnalysis,
  NoOrderBlockClassification,
  NoOrdersBreakdownSummary
} from '../../../types';
import {
  BlockGeometryDataset,
  calculateDistanceKm,
  getBlockCentroid,
  getBranchMarkerPoint
} from '../bahrainBlockGeometry';

/**
 * Pure classification function for a block with zero orders in the current period.
 *
 * Strict precedence rules:
 * 1. If outside service area -> 'outside-service-area' (CHECKED FIRST)
 * 2. If inside service area:
 *    - 0 competitors -> 'white-space'
 *    - 1-2 competitors -> 'contested'
 *    - 3+ competitors -> 'saturated'
 */
export function classifyNoOrderBlock(
  isInsideServiceArea: boolean,
  competitorCount: number
): NoOrderBlockClassification {
  // CRITICAL: Service-area boundary check MUST happen first.
  if (!isInsideServiceArea) {
    return 'outside-service-area';
  }

  if (competitorCount === 0) {
    return 'white-space';
  }

  if (competitorCount <= 2) {
    return 'contested';
  }

  return 'saturated';
}

/**
 * Determines whether a block centroid falls within the extended delivery radius
 * of at least one active, delivery-enabled Tabarak branch.
 */
export function isBlockInsideServiceArea(
  blockNumber: string,
  branchProfiles: BranchDeliveryProfile[],
  dataset: BlockGeometryDataset
): boolean {
  if (!dataset || !dataset.byBlock) {
    return false;
  }

  const cleanBlock = blockNumber.trim();
  const blockCentroid = getBlockCentroid(dataset, cleanBlock);
  if (!blockCentroid) {
    return false;
  }

  return branchProfiles.some(profile => {
    // Only delivery-enabled branches provide service coverage
    if (profile.isDeliveryEnabled === false) return false;

    // Use explicit GPS point if registered, otherwise fallback to origin block centroid
    const markerPoint = getBranchMarkerPoint(
      dataset,
      profile.branchCode || profile.branchName || 'BRANCH',
      profile.originBlockNumber,
      (profile.lat && profile.lng) ? { lat: profile.lat, lng: profile.lng } : undefined
    );
    const branchCentroid = markerPoint.point;
    if (!branchCentroid) return false;

    const distanceKm = calculateDistanceKm(branchCentroid, blockCentroid);
    if (distanceKm === null) return false;

    const maxRadius = profile.extendedRadiusKm || 8;
    return distanceKm <= maxRadius;
  });
}

/**
 * Retrieves and filters competitor pharmacies for a given block number.
 * Explicitly excludes Tabarak's own branches from the competitor list.
 */
export function getCompetitorsForBlock(
  blockNumber: string,
  competitorMap: Record<string, Array<{ name: string; group?: string; type?: string; area?: string }>>
): CompetitorPharmacy[] {
  const cleanKey = blockNumber.trim();
  const entries = competitorMap[cleanKey] || [];

  return entries
    .filter(p => {
      const name = (p.name || '').toUpperCase();
      const group = (p.group || '').toUpperCase();
      return !name.includes('TABARAK') && !group.includes('TABARAK');
    })
    .map(p => ({
      name: p.name,
      group: p.group,
      type: p.type,
      area: p.area
    }));
}

export interface EvaluateNoOrderBlocksParams {
  blocks: DeliveryBlockMetric[];
  branchProfiles: BranchDeliveryProfile[];
  dataset: BlockGeometryDataset;
  competitorMap: Record<string, Array<{ name: string; group?: string; type?: string; area?: string }>> | any;
}

export interface EvaluateNoOrderBlocksResult {
  summary: NoOrdersBreakdownSummary;
  analysisMap: Map<string, NoOrderBlockAnalysis>;
}

/**
 * Evaluates all zero-order blocks against branch delivery reach and competitor presence.
 * Produces structured summaries and prioritizes contested territories.
 */
export function evaluateNoOrderBlocks({
  blocks,
  branchProfiles,
  dataset,
  competitorMap
}: EvaluateNoOrderBlocksParams): EvaluateNoOrderBlocksResult {
  const analysisMap = new Map<string, NoOrderBlockAnalysis>();
  const contestedBlocks: NoOrderBlockAnalysis[] = [];
  const whiteSpaceBlocks: NoOrderBlockAnalysis[] = [];
  const saturatedBlocks: NoOrderBlockAnalysis[] = [];
  const outsideServiceAreaBlocks: NoOrderBlockAnalysis[] = [];

  let contestedSingleCompetitorCount = 0;

  // Filter to zero-order blocks only
  const zeroOrderBlocks = blocks.filter(b => b.orderCount === 0);

  for (const block of zeroOrderBlocks) {
    const cleanNumber = block.blockNumber.trim();
    const isInside = isBlockInsideServiceArea(cleanNumber, branchProfiles, dataset);
    const competitors = getCompetitorsForBlock(cleanNumber, competitorMap || {});
    const competitorCount = competitors.length;
    const classification = classifyNoOrderBlock(isInside, competitorCount);

    let priorityScore = 0;
    let actionRecommendation = '';

    switch (classification) {
      case 'contested': {
        // Higher priority for 1 competitor over 2 competitors
        priorityScore = competitorCount === 1 ? 95 : 80;
        if (competitorCount === 1) {
          contestedSingleCompetitorCount++;
          const competitorName = competitors[0]?.name || 'a competitor';
          actionRecommendation = `High-yield target: Only 1 competitor (${competitorName}) present. Deploy win-back campaigns or localized promotions.`;
        } else {
          const names = competitors.map(c => c.name).slice(0, 2).join(', ');
          actionRecommendation = `Contested block: 2 competitors (${names}). Secondary marketing opportunity.`;
        }
        break;
      }
      case 'white-space': {
        priorityScore = 50;
        actionRecommendation = 'Zero competitors and zero orders. Hold for manual validation to verify residential viability (avoid desert/industrial spend).';
        break;
      }
      case 'saturated': {
        priorityScore = 20;
        actionRecommendation = `Saturated market: ${competitorCount} competitor pharmacies operating. Low marketing ROI; observe for organic pickup only.`;
        break;
      }
      case 'outside-service-area': {
        priorityScore = 0;
        actionRecommendation = 'Beyond branch delivery range. Excluded from marketing campaigns; routed to branch expansion and hub location planning.';
        break;
      }
    }

    const item: NoOrderBlockAnalysis = {
      blockNumber: cleanNumber,
      areaName: block.areaName,
      governorate: block.governorate as Governorate,
      isInsideServiceArea: isInside,
      competitorCount,
      competitors,
      classification,
      priorityScore,
      actionRecommendation
    };

    analysisMap.set(cleanNumber, item);
    if (block.blockNumber !== cleanNumber) {
      analysisMap.set(block.blockNumber, item);
    }

    if (classification === 'contested') {
      contestedBlocks.push(item);
    } else if (classification === 'white-space') {
      whiteSpaceBlocks.push(item);
    } else if (classification === 'saturated') {
      saturatedBlocks.push(item);
    } else if (classification === 'outside-service-area') {
      outsideServiceAreaBlocks.push(item);
    }
  }

  // Prioritize contested blocks: fewest competitors first (1 competitor > 2 competitors),
  // then alphabetically by block number for deterministic ordering
  contestedBlocks.sort((a, b) => {
    if (a.competitorCount !== b.competitorCount) {
      return a.competitorCount - b.competitorCount;
    }
    return a.blockNumber.localeCompare(b.blockNumber);
  });

  const summary: NoOrdersBreakdownSummary = {
    totalNoOrderBlocks: zeroOrderBlocks.length,
    contestedCount: contestedBlocks.length,
    contestedSingleCompetitorCount,
    whiteSpaceCount: whiteSpaceBlocks.length,
    saturatedCount: saturatedBlocks.length,
    outsideServiceAreaCount: outsideServiceAreaBlocks.length,
    contestedBlocks,
    whiteSpaceBlocks,
    saturatedBlocks,
    outsideServiceAreaBlocks
  };

  return {
    summary,
    analysisMap
  };
}
