import { finite, num, statusIs, includes, countTrue } from '../../src/facts/core.js';
import { allAssessed, countPresent, toTri } from '../../src/facts/tristate.js';
import { createUnitValidatedDeriver } from '../../src/units.js';
import { getEffectiveRanges, getFerritinThreshold } from '../../modules/anemia/ranges.js';
import moduleManifest from './module.json' with { type: 'json' };
import './units.js';

// The single source of truth for this module's supported age scope (docs/architecture.md §10
// condition 2: "age is outside a supported range and local limits are missing"). Read from
// modules/anemia/module.json's supportedAgeMonths — never hardcoded here — so the manifest stays
// the one place this boundary is declared (EP5-T6; previously this file hardcoded 6/216 inline,
// which was a second, driftable source of truth for the exact same number the manifest already
// carries as a governance-hashed field, per src/kbVerify.js's GOVERNANCE_FIELD_KEYS).
const SUPPORTED_AGE_MONTHS_MIN = Number.isFinite(moduleManifest.supportedAgeMonths?.min)
  ? moduleManifest.supportedAgeMonths.min
  : null;
const SUPPORTED_AGE_MONTHS_MAX = Number.isFinite(moduleManifest.supportedAgeMonths?.max)
  ? moduleManifest.supportedAgeMonths.max
  : null;

function triAny(values) {
  if (countPresent(values) > 0) return 'true';
  return allAssessed(values) ? 'false' : 'unknown';
}

function triAll(values) {
  if (values.some((value) => toTri(value) === 'false')) return 'false';
  return allAssessed(values) ? 'true' : 'unknown';
}

function triNone(values) {
  if (countPresent(values) > 0) return 'false';
  return allAssessed(values) ? 'true' : 'unknown';
}

function cytopeniaTri(localFlag, countValue, localLowerBound) {
  const flagTri = toTri(localFlag);
  if (flagTri === 'true') return 'true';
  if (countValue !== null && finite(localLowerBound)) {
    return countValue < Number(localLowerBound) ? 'true' : 'false';
  }
  if (flagTri === 'false') return 'false';
  return 'unknown';
}

function deriveFactsFromSnapshot(input = {}) {
  const patient = input.patient ?? {};
  const cbc = input.cbc ?? {};
  const localFlags = cbc.localFlags ?? {};
  const retic = input.reticulocytes ?? {};
  const labs = input.labs ?? {};
  const history = input.history ?? {};
  const symptoms = input.symptoms ?? {};
  const exam = input.exam ?? {};
  const smearValues = input.smear ?? [];

  const ageMonths = num(patient.ageMonths);
  const hb = num(cbc.hemoglobin);
  const mcv = num(cbc.mcv);
  const rdw = num(cbc.rdw);
  const rbc = num(cbc.rbc);
  const wbc = num(cbc.wbc);
  const anc = num(cbc.anc);
  const platelets = num(cbc.platelets);

  const ranges = getEffectiveRanges(input);
  const supportedAge = ageMonths !== null
    && SUPPORTED_AGE_MONTHS_MIN !== null && SUPPORTED_AGE_MONTHS_MAX !== null
    && ageMonths >= SUPPORTED_AGE_MONTHS_MIN && ageMonths < SUPPORTED_AGE_MONTHS_MAX;
  const neonatalOrYoungInfant = ageMonths !== null
    && SUPPORTED_AGE_MONTHS_MIN !== null && ageMonths < SUPPORTED_AGE_MONTHS_MIN;
  const outsidePediatricRange = ageMonths !== null
    && SUPPORTED_AGE_MONTHS_MAX !== null && ageMonths >= SUPPORTED_AGE_MONTHS_MAX;

  let anemiaStatus = 'indeterminate';
  if (hb !== null && ranges.hbLower !== null) {
    anemiaStatus = hb < ranges.hbLower ? 'present' : 'absent';
  }

  let morphology = 'indeterminate';
  if (mcv !== null && ranges.mcvLower !== null && ranges.mcvUpper !== null) {
    if (mcv < ranges.mcvLower) morphology = 'microcytic';
    else if (mcv > ranges.mcvUpper) morphology = 'macrocytic';
    else morphology = 'normocytic';
  }

  const rdwHigh = rdw !== null && ranges.rdwUpper !== null ? rdw > ranges.rdwUpper : null;
  const ferritin = num(labs.ferritin);
  const ferritinThreshold = getFerritinThreshold(
    ageMonths,
    patient.menstruating,
    ferritin === null ? undefined : labs.ferritinUnit,
  );
  const ferritinLow = ferritin !== null && ferritinThreshold
    ? ferritin <= ferritinThreshold.value
    : null;
  const ferritinNotLow = ferritinLow === false;

  const stfrFerritinIndex = num(labs.stfrFerritinIndex);
  const stfrIndexHigh = stfrFerritinIndex !== null ? stfrFerritinIndex > 2 : null;
  const stfrIndexLow = stfrFerritinIndex !== null ? stfrFerritinIndex < 1 : null;
  const stfrIndexIntermediate = stfrFerritinIndex !== null
    ? stfrFerritinIndex >= 1 && stfrFerritinIndex <= 2
    : null;

  const crpElevated = statusIs(labs.crpStatus, 'elevated');
  const crpNormal = statusIs(labs.crpStatus, 'normal');
  const crpKnown = ['elevated', 'normal'].includes(String(labs.crpStatus ?? '').toLowerCase());
  const tsatLow = statusIs(labs.tsatStatus, 'low');
  const tibcLowOrNormal = ['low', 'normal'].includes(String(labs.tibcStatus ?? '').toLowerCase());
  const ironHigh = statusIs(labs.ironStatus, 'high');
  const ferritinHigh = statusIs(labs.ferritinStatus, 'high');

  const reticResponse = String(retic.response ?? 'unknown').toLowerCase();
  const reticHigh = reticResponse === 'high';
  const reticLow = ['low', 'inappropriately-normal'].includes(reticResponse);
  const reticKnown = !['', 'unknown'].includes(reticResponse);

  const hemolysisMarkers = {
    bilirubinHigh: statusIs(labs.indirectBilirubinStatus, 'high'),
    ldhHigh: statusIs(labs.ldhStatus, 'high'),
    haptoglobinLow: statusIs(labs.haptoglobinStatus, 'low'),
  };
  const hemolysisMarkerCount = countTrue(Object.values(hemolysisMarkers));
  const hemolysisPattern = hemolysisMarkerCount >= 2;
  const datPositive = statusIs(labs.datStatus, 'positive');
  const datNegative = statusIs(labs.datStatus, 'negative');

  const bll = num(labs.bloodLeadLevel);
  const leadSpecimen = String(labs.leadSpecimen ?? 'unknown').toLowerCase();
  const leadAtOrAboveReference = bll !== null && bll >= 3.5;
  const lead20to44 = bll !== null && bll >= 20 && bll < 45;
  const lead45Plus = bll !== null && bll >= 45;
  const elevatedCapillaryLead = leadAtOrAboveReference && leadSpecimen === 'capillary';

  const leukopeniaTri = cytopeniaTri(localFlags.leukopenia, wbc, cbc.localRanges?.wbcLower);
  const neutropeniaTri = cytopeniaTri(localFlags.neutropenia, anc, cbc.localRanges?.ancLower);
  const thrombocytopeniaTri = cytopeniaTri(
    localFlags.thrombocytopenia,
    platelets,
    cbc.localRanges?.plateletsLower,
  );
  const additionalCytopeniaValues = [leukopeniaTri, neutropeniaTri, thrombocytopeniaTri];
  const anemiaPresentTri = anemiaStatus === 'present'
    ? 'true'
    : anemiaStatus === 'absent' ? 'false' : 'unknown';
  const thrombocytosis = toTri(localFlags.thrombocytosis);
  const additionalCytopeniaCount = countPresent(additionalCytopeniaValues);
  const multilineageCytopenia = triAll([anemiaPresentTri, triAny(additionalCytopeniaValues)]);
  const isolatedAnemia = triAll([anemiaPresentTri, triNone(additionalCytopeniaValues)]);

  const instability = triAny([
    toTri(symptoms.respiratoryDistress),
    toTri(symptoms.syncope),
    toTri(symptoms.alteredMentalStatus),
    toTri(symptoms.chestPain),
    toTri(symptoms.heartFailureSigns),
    toTri(symptoms.hemodynamicInstability),
  ]);

  const activeMajorBleeding = toTri(symptoms.activeMajorBleeding);
  const bleedingHistory = triAny([
    toTri(history.giBloodLoss),
    toTri(history.heavyMenstrualBleeding),
    toTri(history.recurrentEpistaxis),
    toTri(history.frequentBloodDonation),
    toTri(history.otherBloodLoss),
    activeMajorBleeding,
  ]);

  const ironRiskHistory = triAny([
    toTri(history.excessCowMilk),
    toTri(history.cowMilkBefore12Months),
    toTri(history.lowIronDiet),
    toTri(history.vegetarianOrVegan),
    toTri(history.foodInsecurity),
    toTri(history.pica),
    toTri(history.prematurity),
    toTri(history.malabsorption),
    bleedingHistory,
  ]);

  const chronicInflammation = triAny([
    toTri(history.inflammatoryBowelDisease),
    toTri(history.rheumatologicDisease),
    toTri(history.chronicInfection),
    toTri(history.otherInflammatoryDisease),
  ]);

  const renalSignal = statusIs(labs.creatinineStatus, 'high')
    ? 'true'
    : toTri(history.chronicKidneyDisease);
  const liverSignal = statusIs(labs.liverTestsStatus, 'abnormal')
    ? 'true'
    : toTri(history.liverDisease);
  const thyroidSignal = statusIs(labs.tshStatus, 'high')
    ? 'true'
    : toTri(history.thyroidDisease);
  const b12Low = statusIs(labs.b12Status, 'low');
  const folateLow = statusIs(labs.folateStatus, 'low');
  const copperLow = statusIs(labs.copperStatus, 'low');

  const familyHemoglobinopathy = triAny([
    toTri(history.familyThalassemia),
    toTri(history.familySickleCell),
    toTri(history.familyHemoglobinopathy),
  ]);

  const knownChronicHemolyticDisease = triAny([
    toTri(history.knownSickleCellDisease),
    toTri(history.knownHereditarySpherocytosis),
    toTri(history.knownThalassemiaMajor),
    toTri(history.otherChronicHemolyticDisease),
  ]);

  const smear = {
    provided: smearValues.length > 0,
    targetCells: includes(smearValues, 'target-cells'),
    spherocytes: includes(smearValues, 'spherocytes'),
    schistocytes: includes(smearValues, 'schistocytes'),
    biteOrBlisterCells: includes(smearValues, 'bite-or-blister-cells'),
    sickleCells: includes(smearValues, 'sickle-cells'),
    basophilicStippling: includes(smearValues, 'basophilic-stippling'),
    hypersegmentedNeutrophils: includes(smearValues, 'hypersegmented-neutrophils'),
    blasts: includes(smearValues, 'blasts'),
    teardrops: includes(smearValues, 'teardrops'),
    nucleatedRbc: includes(smearValues, 'nucleated-rbc'),
    elliptocytes: includes(smearValues, 'elliptocytes'),
  };

  const severeIdaHbCategory = anemiaStatus === 'present' && hb !== null && hb < 7;
  const hbModerateIdaCategory = anemiaStatus === 'present' && hb !== null && hb >= 7 && hb < 9;
  const hbMildIdaCategory = anemiaStatus === 'present' && hb !== null && hb >= 9;

  const rbcRelativelyHigh = cbc.rbcInterpretation === 'high-for-age'
    ? 'true'
    : ['normal', 'low'].includes(cbc.rbcInterpretation) ? 'false' : 'unknown';
  const hemoglobinAnalysis = {
    hbA2Elevated: statusIs(labs.hbA2Status, 'elevated'),
    hbBartNewbornScreen: toTri(labs.hbBartNewbornScreen),
    alphaGlobinPositive: toTri(labs.alphaGlobinTestingPositive),
    betaGlobinPositive: toTri(labs.betaGlobinTestingPositive),
    sicklingHemoglobinDetected: toTri(labs.sicklingHemoglobinDetected),
  };

  const g6pd = {
    deficient: statusIs(labs.g6pdStatus, 'deficient'),
    normal: statusIs(labs.g6pdStatus, 'normal'),
    testedDuringAcuteHemolysis: toTri(labs.g6pdTestDuringAcuteHemolysis),
    testedSoonAfterTransfusion: toTri(labs.g6pdTestSoonAfterTransfusion),
  };

  const congenitalMarrowFailureSignalValues = [
    toTri(history.congenitalAnomalies),
    toTri(history.thumbOrRadiusAnomaly),
    toTri(history.shortStature),
    toTri(history.abnormalSkinPigmentation),
    toTri(history.microcephaly),
  ];
  const congenitalMarrowFailureSignals = countPresent(congenitalMarrowFailureSignalValues);
  const congenitalSignalsFullyAssessed = allAssessed(congenitalMarrowFailureSignalValues);

  const recentViral = toTri(history.recentViralIllness);
  const ageCompatibleWithTec = ageMonths !== null && ageMonths >= 6 && ageMonths < 72;
  const ageCompatibleWithDba = ageMonths !== null && ageMonths < 12;

  return {
    input,
    patient: {
      ageMonths,
      sexAtBirth: patient.sexAtBirth ?? null,
      menstruating: toTri(patient.menstruating),
      recentTransfusion: toTri(patient.recentTransfusion),
      highAltitude: toTri(patient.highAltitude),
    },
    scope: {
      supportedAge,
      neonatalOrYoungInfant,
      outsidePediatricRange,
      builtInRangeAvailable: Boolean(ranges.provenance?.builtInAgeBand),
      needsLocalRanges: !Number.isFinite(ranges.hbLower)
        || !Number.isFinite(ranges.mcvLower)
        || !Number.isFinite(ranges.mcvUpper),
    },
    thresholds: {
      ...ranges,
      ferritin: ferritinThreshold?.value ?? null,
      ferritinRationale: ferritinThreshold?.rationale ?? null,
    },
    cbc: {
      hb,
      mcv,
      rdw,
      rbc,
      wbc,
      anc,
      platelets,
      leukopenia: leukopeniaTri,
      neutropenia: neutropeniaTri,
      thrombocytopenia: thrombocytopeniaTri,
      thrombocytosis,
      additionalCytopeniaCount,
      multilineageCytopenia,
      isolatedAnemia,
      rbcRelativelyHigh,
    },
    anemia: {
      status: anemiaStatus,
      present: anemiaStatus === 'present',
      absent: anemiaStatus === 'absent',
      indeterminate: anemiaStatus === 'indeterminate',
      severeIdaHbCategory,
      moderateIdaHbCategory: hbModerateIdaCategory,
      mildIdaHbCategory: hbMildIdaCategory,
    },
    morphology: {
      value: morphology,
      microcytic: morphology === 'microcytic',
      normocytic: morphology === 'normocytic',
      macrocytic: morphology === 'macrocytic',
      indeterminate: morphology === 'indeterminate',
      rdwHigh,
      rdwKnown: rdwHigh !== null,
    },
    retic: {
      response: reticResponse,
      high: reticHigh,
      low: reticLow,
      known: reticKnown,
      unknown: !reticKnown,
    },
    ferritin: {
      value: ferritin,
      available: ferritin !== null,
      low: ferritinLow,
      notLow: ferritinNotLow,
      highByLab: ferritinHigh,
      threshold: ferritinThreshold?.value ?? null,
      crpElevated,
      crpNormal,
      crpKnown,
      potentiallyInflammationConfounded: ferritinNotLow && crpElevated,
    },
    iron: {
      tsatLow,
      tibcLowOrNormal,
      ironHigh,
      stfrFerritinIndex,
      stfrIndexHigh,
      stfrIndexLow,
      stfrIndexIntermediate,
      inflammatoryIronRestrictionPattern:
        anemiaStatus === 'present'
        && crpElevated
        && ferritinNotLow
        && tsatLow
        && tibcLowOrNormal,
    },
    hemolysis: {
      ...hemolysisMarkers,
      markerCount: hemolysisMarkerCount,
      pattern: hemolysisPattern,
      datPositive,
      datNegative,
    },
    lead: {
      value: bll,
      specimen: leadSpecimen,
      available: bll !== null,
      atOrAboveReference: leadAtOrAboveReference,
      elevatedCapillary: elevatedCapillaryLead,
      level20to44: lead20to44,
      level45Plus: lead45Plus,
    },
    smear,
    symptoms: {
      instability,
      activeMajorBleeding,
      jaundiceOrDarkUrine: triAny([toTri(symptoms.jaundice), toTri(symptoms.darkUrine)]),
      fever: toTri(symptoms.fever),
      neurologicSymptoms: triAny([
        toTri(symptoms.alteredMentalStatus),
        toTri(symptoms.neurologicSymptoms),
      ]),
      renalSymptoms: triAny([toTri(symptoms.oliguria), toTri(symptoms.renalSymptoms)]),
      fatigueOrPallor: triAny([toTri(symptoms.fatigue), toTri(symptoms.pallor)]),
    },
    exam: {
      splenomegaly: toTri(exam.splenomegaly),
      hepatomegaly: toTri(exam.hepatomegaly),
      lymphadenopathy: toTri(exam.lymphadenopathy),
      petechiaeOrBruising: triAny([toTri(exam.petechiae), toTri(exam.unexplainedBruising)]),
    },
    history: {
      ...history,
      pica: toTri(history.pica),
      leadExposureRisk: toTri(history.leadExposureRisk),
      knownHereditarySpherocytosis: toTri(history.knownHereditarySpherocytosis),
      knownSickleCellDisease: toTri(history.knownSickleCellDisease),
      thumbOrRadiusAnomaly: toTri(history.thumbOrRadiusAnomaly),
      abnormalSkinPigmentation: toTri(history.abnormalSkinPigmentation),
      shortStature: toTri(history.shortStature),
      priorAdequateIronTrialNoResponse: toTri(history.priorAdequateIronTrialNoResponse),
      adherenceVerified: toTri(history.adherenceVerified),
      ongoingBloodLossKnown: toTri(history.ongoingBloodLossKnown),
      bleedingHistory,
      ironRiskHistory,
      chronicInflammation,
      renalSignal,
      liverSignal,
      thyroidSignal,
      familyHemoglobinopathy,
      knownChronicHemolyticDisease,
      recentViral,
      oxidantTrigger: toTri(history.oxidantMedicationOrFavaExposure),
      malariaRisk: toTri(history.malariaTravelOrResidence),
      medicationMacrocytosisRisk: toTri(history.macrocytosisAssociatedMedication),
    },
    nutrition: {
      b12Low,
      folateLow,
      copperLow,
    },
    hemoglobinAnalysis,
    g6pd,
    marrow: {
      congenitalSignalCount: congenitalMarrowFailureSignals,
      congenitalSignalsFullyAssessed,
      ageCompatibleWithTec,
      ageCompatibleWithDba,
    },
  };
}

// Shared with the engine boundary so direct module consumers receive the same one-snapshot
// guarantee. Future modules can wrap their raw derivation function without duplicating policy.
export const deriveFacts = createUnitValidatedDeriver('anemia', deriveFactsFromSnapshot);

// ---------------------------------------------------------------------------------------------
// ARCH §10 condition 2 — "age is outside a supported range and local limits are missing" must
// refuse to produce an assessment, not merely narrow the limitations text (EP5-T6; the phase plan's
// own wording). Follows the SAME rejection shape as src/units.js's UnitRejectionError (name/code/
// statusCode/details) so server.mjs and src/app.js can handle both consistently.
// ---------------------------------------------------------------------------------------------

export class AgeOutOfSupportedRangeError extends Error {
  constructor({ ageMonths, supportedAgeMonths }) {
    super(
      `Patient age (${ageMonths} months) is outside this module's supported age range `
        + `(${supportedAgeMonths?.min}-${supportedAgeMonths?.max} months, per `
        + "modules/anemia/module.json's supportedAgeMonths) and no local CBC reference limits "
        + '(cbc.localRanges.hbLower/mcvLower/mcvUpper) were supplied to cover it. Refusing to '
        + 'produce an assessment (docs/architecture.md §10).',
    );
    this.name = 'AgeOutOfSupportedRangeError';
    this.code = 'AGE_OUT_OF_SUPPORTED_RANGE';
    this.statusCode = 400;
    this.details = [{
      field: 'patient.ageMonths',
      ageMonths,
      supportedAgeMonths: supportedAgeMonths ?? null,
      reason: 'age-outside-supported-range-no-local-limits',
    }];
  }
}

/**
 * The module-descriptor `assertInScope` hook (see modules/anemia/index.js and src/engine.js#assess,
 * which calls `module.assertInScope?.(facts)` generically — engine.js itself never references age
 * or any anemia-specific fact path, keeping it module-agnostic per docs/architecture.md §2a).
 *
 * Deliberately NOT called from inside deriveFactsFromSnapshot/deriveFacts: fact derivation stays a
 * pure, always-succeeding introspection primitive. tests/witness/branch-seam.test.mjs and
 * tests/tristate-safety-invariant.test.mjs call deriveFacts() directly (bypassing assess()) to
 * inspect intermediate facts for ages outside the supported range (e.g. proving the ferritin
 * threshold and CBC reference bands correctly resolve to null there) — those call sites must keep
 * working unchanged. Only assess() — the "produce a real, patient-facing assessment" boundary —
 * refuses.
 *
 * Reuses facts.scope.supportedAge/needsLocalRanges, the SAME facts this file already computed for
 * the pre-EP5-T6 "narrow limitations text" behavior (modules/anemia/index.js#limitations and rules
 * SCOPE-001/SCOPE-002) — this is a strengthening of an existing signal, not a parallel/third
 * source of truth. `needsLocalRanges` is false the moment a caller supplies local
 * cbc.localRanges.{hbLower,mcvLower,mcvUpper} covering the analytes the built-in age-band table
 * would otherwise have supplied — i.e. exactly "the caller supplies local ranges covering that
 * age", the carve-out EP5-T6 specifies.
 *
 * A null/unknown age is NOT this condition (that is a missingness case, not an out-of-range one) —
 * `assess()` still proceeds and every downstream fact naturally reads as tri-state 'unknown'.
 */
export function assertAgeWithinSupportedScope(facts) {
  const ageMonths = facts?.patient?.ageMonths ?? null;
  if (ageMonths === null) return;
  if (facts?.scope?.supportedAge) return;
  if (!facts?.scope?.needsLocalRanges) return;
  throw new AgeOutOfSupportedRangeError({
    ageMonths,
    supportedAgeMonths: moduleManifest.supportedAgeMonths ?? null,
  });
}
