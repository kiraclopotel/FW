// FeelingWise - Severity Scoring with Age Adjustment
//
// Base aggregation:
//   1 technique: that technique's severity
//   2 techniques: highest + (second * 0.3), cap 10
//   3+: highest + sum(remaining * 0.2), cap 10
//
// Age modifiers (added AFTER base calculation):
//   Child 8-11: shame +3, fear +2, anger +2, fomo +1, bandwagon +1, etc.
//   Teen 12-14: fomo +3, shame +2, bandwagon +2, etc.
//   Teen 15-17: fomo +2, shame +1, etc.
//   Adult: all +0
//
// See MASTER_BUILD_GUIDE.md Section 7 for full modifier table.
//
// TODO: Implement
