export const CLUSTER_BRANCHES = {
  'North Cluster': ['Branch 101', 'Branch 102', 'Branch 105', 'Branch 110'],
  'Central Cluster': ['Branch 201', 'Branch 202', 'Branch 205', 'Branch 220'],
  'South Cluster': ['Branch 301', 'Branch 302', 'Branch 305'],
  'East Cluster': ['Branch 401', 'Branch 402', 'Branch 405', 'Branch 410']
};

export const ALL_CLUSTERS = Object.keys(CLUSTER_BRANCHES);
export const ALL_BRANCHES = Object.values(CLUSTER_BRANCHES).flat();
