import { finite, num, isTrue, statusIs, includes, countTrue } from '../../src/facts/core.js';
import { getEffectiveRanges, getFerritinThreshold } from '../../modules/anemia/ranges.js';

export function deriveFacts(rawInput = {}) {
  const input = structuredClone(rawInput ?? {});
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
  const supportedAge = ageMonths !== null && ageMonths >= 6 && ageMonths < 216;
  const neonatalOrYoungInfant = ageMonths !== null && ageMonths < 6;
  const outsidePediatricRange = ageMonths !== null && ageMonths >= 216;

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
  const ferritinThreshold = getFerritinThreshold(ageMonths, patient.menstruating);
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

  const leukopenia = isTrue(localFlags.leukopenia)
    || (wbc !== null && finite(cbc.localRanges?.wbcLower) && wbc < Number(cbc.localRanges.wbcLower));
  const neutropenia = isTrue(localFlags.neutropenia)
    || (anc !== null && finite(cbc.localRanges?.ancLower) && anc < Number(cbc.localRanges.ancLower));
  const thrombocytopenia = isTrue(localFlags.thrombocytopenia)
    || (platelets !== null
      && finite(cbc.localRanges?.plateletsLower)
      && platelets < Number(cbc.localRanges.plateletsLower));
  const thrombocytosis = isTrue(localFlags.thrombocytosis);
  const additionalCytopeniaCount = countTrue([leukopenia, neutropenia, thrombocytopenia]);
  const multilineageCytopenia = anemiaStatus === 'present' && additionalCytopeniaCount > 0;

  const instability = countTrue([
    symptoms.respiratoryDistress,
    symptoms.syncope,
    symptoms.alteredMentalStatus,
    symptoms.chestPain,
    symptoms.heartFailureSigns,
    symptoms.hemodynamicInstability,
  ]) > 0;

  const bleedingHistory = countTrue([
    history.giBloodLoss,
    history.heavyMenstrualBleeding,
    history.recurrentEpistaxis,
    history.frequentBloodDonation,
    history.otherBloodLoss,
    symptoms.activeMajorBleeding,
  ]) > 0;

  const ironRiskHistory = countTrue([
    history.excessCowMilk,
    history.cowMilkBefore12Months,
    history.lowIronDiet,
    history.vegetarianOrVegan,
    history.foodInsecurity,
    history.pica,
    history.prematurity,
    history.malabsorption,
    bleedingHistory,
  ]) > 0;

  const chronicInflammation = countTrue([
    history.inflammatoryBowelDisease,
    history.rheumatologicDisease,
    history.chronicInfection,
    history.otherInflammatoryDisease,
  ]) > 0;

  const renalSignal = history.chronicKidneyDisease === true || statusIs(labs.creatinineStatus, 'high');
  const liverSignal = history.liverDisease === true || statusIs(labs.liverTestsStatus, 'abnormal');
  const thyroidSignal = history.thyroidDisease === true || statusIs(labs.tshStatus, 'high');
  const b12Low = statusIs(labs.b12Status, 'low');
  const folateLow = statusIs(labs.folateStatus, 'low');
  const copperLow = statusIs(labs.copperStatus, 'low');

  const familyHemoglobinopathy = countTrue([
    history.familyThalassemia,
    history.familySickleCell,
    history.familyHemoglobinopathy,
  ]) > 0;

  const knownChronicHemolyticDisease = countTrue([
    history.knownSickleCellDisease,
    history.knownHereditarySpherocytosis,
    history.knownThalassemiaMajor,
    history.otherChronicHemolyticDisease,
  ]) > 0;

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

  const rbcRelativelyHigh = cbc.rbcInterpretation === 'high-for-age';
  const hemoglobinAnalysis = {
    hbA2Elevated: statusIs(labs.hbA2Status, 'elevated'),
    hbBartNewbornScreen: isTrue(labs.hbBartNewbornScreen),
    alphaGlobinPositive: isTrue(labs.alphaGlobinTestingPositive),
    betaGlobinPositive: isTrue(labs.betaGlobinTestingPositive),
    sicklingHemoglobinDetected: isTrue(labs.sicklingHemoglobinDetected),
  };

  const g6pd = {
    deficient: statusIs(labs.g6pdStatus, 'deficient'),
    normal: statusIs(labs.g6pdStatus, 'normal'),
    testedDuringAcuteHemolysis: isTrue(labs.g6pdTestDuringAcuteHemolysis),
    testedSoonAfterTransfusion: isTrue(labs.g6pdTestSoonAfterTransfusion),
  };

  const congenitalMarrowFailureSignals = countTrue([
    history.congenitalAnomalies,
    history.thumbOrRadiusAnomaly,
    history.shortStature,
    history.abnormalSkinPigmentation,
    history.microcephaly,
  ]);

  const isolatedAnemia = anemiaStatus === 'present' && additionalCytopeniaCount === 0;
  const recentViral = history.recentViralIllness === true;
  const ageCompatibleWithTec = ageMonths !== null && ageMonths >= 6 && ageMonths < 72;
  const ageCompatibleWithDba = ageMonths !== null && ageMonths < 12;

  return {
    input,
    patient: {
      ageMonths,
      sexAtBirth: patient.sexAtBirth ?? null,
      menstruating: patient.menstruating === true,
      recentTransfusion: patient.recentTransfusion === true,
      highAltitude: patient.highAltitude === true,
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
      leukopenia,
      neutropenia,
      thrombocytopenia,
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
      activeMajorBleeding: symptoms.activeMajorBleeding === true,
      jaundiceOrDarkUrine: symptoms.jaundice === true || symptoms.darkUrine === true,
      fever: symptoms.fever === true,
      neurologicSymptoms: symptoms.alteredMentalStatus === true || symptoms.neurologicSymptoms === true,
      renalSymptoms: symptoms.oliguria === true || symptoms.renalSymptoms === true,
      fatigueOrPallor: symptoms.fatigue === true || symptoms.pallor === true,
    },
    exam: {
      splenomegaly: exam.splenomegaly === true,
      hepatomegaly: exam.hepatomegaly === true,
      lymphadenopathy: exam.lymphadenopathy === true,
      petechiaeOrBruising: exam.petechiae === true || exam.unexplainedBruising === true,
    },
    history: {
      ...history,
      bleedingHistory,
      ironRiskHistory,
      chronicInflammation,
      renalSignal,
      liverSignal,
      thyroidSignal,
      familyHemoglobinopathy,
      knownChronicHemolyticDisease,
      recentViral,
      oxidantTrigger: history.oxidantMedicationOrFavaExposure === true,
      malariaRisk: history.malariaTravelOrResidence === true,
      medicationMacrocytosisRisk: history.macrocytosisAssociatedMedication === true,
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
      ageCompatibleWithTec,
      ageCompatibleWithDba,
    },
  };
}
