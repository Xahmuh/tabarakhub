import {
  BranchDeliveryProfile,
  DeliveryBlockMetric,
  DeliveryBlockZoneAnalysis,
  DeliveryCoverageSummary,
  DeliveryZoneQualityMetrics
} from '../../types';
import {
  BlockGeometryDataset,
  calculateDistanceKm,
  classifyDistanceZone,
  getBlockCentroid
} from '../delivery/bahrainBlockGeometry';

const emptyZoneMetrics = (geometry?: BlockGeometryDataset | null): DeliveryZoneQualityMetrics => ({
  totalBranchProfiles: 0,
  mappedBranchMarkers: 0,
  unmappedBranchMarkers: 0,
  duplicateBranchBlockGroups: [],
  missingOriginBlock: 0,
  missingGeoJsonBlock: 0,
  servedCoreBlocks: 0,
  servedStandardBlocks: 0,
  servedExtendedBlocks: 0,
  servedOutsideRangeBlocks: 0,
  unmappedServedBlocks: 0,
  missingBranchProfiles: 0,
  servedBlocksMapped: 0,
  servedBlocksUnavailableZone: 0,
  totalGeometryBlocks: geometry?.featureCount || 0
});

const zoneAction = (zone: DeliveryBlockZoneAnalysis['zone'], orders: number) => {
  if (zone === 'core') return orders >= 5 ? 'Strong natural service area. Maintain service quality.' : 'Core service area. Monitor quality and repeat demand.';
  if (zone === 'standard') return 'Normal delivery coverage. Monitor capacity.';
  if (zone === 'extended') return 'Extended coverage pressure. Review routing or nearby branch support.';
  if (zone === 'outside_range') return 'Coverage review candidate. Consider routing review, campaign test, or future expansion study.';
  return 'Distance unavailable because branch profile or block geometry is missing.';
};

export const buildOwnerZoneAnalysis = (
  summary: DeliveryCoverageSummary | null,
  branchProfiles: BranchDeliveryProfile[],
  geometry?: BlockGeometryDataset | null
): { metrics: DeliveryZoneQualityMetrics; byBlock: Map<string, DeliveryBlockZoneAnalysis> } => {
  const metrics = emptyZoneMetrics(geometry);
  const byBlock = new Map<string, DeliveryBlockZoneAnalysis>();
  if (!summary) return { metrics, byBlock };

  const activeProfiles = branchProfiles.filter(profile => profile.isDeliveryEnabled !== false);
  const profileByBranch = new Map(activeProfiles.map(profile => [profile.branchId, profile]));
  metrics.totalBranchProfiles = activeProfiles.length;
  metrics.missingBranchProfiles = summary.branchCoverage.filter(branch => !profileByBranch.has(branch.branchId)).length;

  const duplicateMap = new Map<string, string[]>();
  for (const profile of activeProfiles) {
    const originBlock = profile.originBlockNumber?.trim();
    if (!originBlock) {
      metrics.missingOriginBlock += 1;
      metrics.unmappedBranchMarkers += 1;
      continue;
    }

    const duplicateGroup = duplicateMap.get(originBlock) || [];
    duplicateGroup.push(profile.branchCode || profile.branchName || profile.branchId.slice(0, 6));
    duplicateMap.set(originBlock, duplicateGroup);

    if (geometry?.available && getBlockCentroid(geometry, originBlock)) {
      metrics.mappedBranchMarkers += 1;
    } else {
      metrics.unmappedBranchMarkers += 1;
      if (geometry?.available) metrics.missingGeoJsonBlock += 1;
    }
  }

  metrics.duplicateBranchBlockGroups = [...duplicateMap.entries()]
    .filter(([, branchCodes]) => branchCodes.length > 1)
    .map(([originBlockNumber, branchCodes]) => ({ originBlockNumber, branchCodes }));

  for (const block of summary.blocks) {
    const servedPoint = geometry?.available ? getBlockCentroid(geometry, block.blockNumber) : null;
    if (servedPoint) metrics.servedBlocksMapped += 1;
    else metrics.unmappedServedBlocks += 1;

    const profile = block.dominantBranchId ? profileByBranch.get(block.dominantBranchId) : undefined;
    const branchPoint = profile && geometry?.available ? getBlockCentroid(geometry, profile.originBlockNumber) : null;
    const distanceKm = calculateDistanceKm(branchPoint, servedPoint);
    const zone = classifyDistanceZone(distanceKm, profile);

    if (zone === 'core') metrics.servedCoreBlocks += 1;
    else if (zone === 'standard') metrics.servedStandardBlocks += 1;
    else if (zone === 'extended') metrics.servedExtendedBlocks += 1;
    else if (zone === 'outside_range') metrics.servedOutsideRangeBlocks += 1;
    else metrics.servedBlocksUnavailableZone += 1;

    const reason = !profile
      ? 'branch profile missing'
      : !branchPoint
        ? 'branch origin block not mapped'
        : !servedPoint
          ? 'served block not mapped'
          : undefined;

    byBlock.set(block.blockNumber, {
      blockNumber: block.blockNumber,
      branchId: block.dominantBranchId,
      branchName: block.dominantBranchName,
      branchCode: profile?.branchCode || undefined,
      originBlockNumber: profile?.originBlockNumber,
      zone,
      distanceKm,
      reason,
      recommendedAction: reason ? 'Distance unavailable because block geometry or branch profile is missing.' : zoneAction(zone, block.orderCount)
    });
  }

  return { metrics, byBlock };
};

export const ownerMapBlocksWithGeometry = (
  blocks: DeliveryBlockMetric[],
  geometry?: BlockGeometryDataset | null
) => geometry?.available
  ? blocks.filter(block => geometry.byBlock.has(block.blockNumber.trim()))
  : [];

export const ownerGeometryStats = (
  blocks: DeliveryBlockMetric[],
  geometry?: BlockGeometryDataset | null
) => {
  if (!geometry?.available) return { matched: 0, total: blocks.length, unmatched: blocks.length };
  const matched = blocks.filter(block => geometry.byBlock.has(block.blockNumber.trim())).length;
  return { matched, total: blocks.length, unmatched: Math.max(0, blocks.length - matched) };
};
