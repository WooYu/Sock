package com.stockcal.scenario;

import com.stockcal.market.MarketProvider.Candle;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import tools.jackson.databind.JsonNode;

/** Wire contracts for immutable research records; owner and receipt are server generated. */
public final class ScenarioContracts {
    private ScenarioContracts() {}
    public static final String SCORE_VERSION = "ohlc-price-closeness-v1";
    public static final String TARGET_POLICY = "first-observed-complete-daily-v1";
    public record SaveForecastRequest(JsonNode snapshot, List<NoteBindingInput> noteBindings) {}
    public record LegacyNoteKey(String legacyRecordId, String level, String sourceHash, int tagVersion, String channel) {}
    public record NoteBindingInput(String revisionId, String sourceHash, LegacyNoteKey legacyKey, JsonNode inlineVersion) {}
    public record FrozenNoteBinding(String status, String revisionId, String sourceHash, LegacyNoteKey legacyKey,
                                    JsonNode inlineVersion, NoteStudyRevision study) {}
    public record ForecastLevel(String id, long priceCents, List<String> groupIds) {}
    public record LevelCloseness(String id, long priceCents, List<String> groupIds, Map<String,Double> errors,
                                 String nearest, List<String> matches, boolean exactMatch) {}
    public record TargetCloseness(long priceCents, boolean covered, List<String> levelIds, Double nearestError) {}
    public record PriceClosenessResult(String definitionVersion, List<LevelCloseness> levels,
        Map<String,TargetCloseness> targets, int totalLevels, int closeLevels, Double levelClosenessRatio,
        int coveredTargets, int exactLevels) {}
    public record ForecastRecord(String id, String owner, String clientRecordId, int clientVersion,
        String previousRecordId, String symbol, String kind, Instant serverReceivedAt, Instant clientCreatedAt,
        Instant inputAsOf, LocalDate anchorDay, String method, String definitionVersion, String payloadHash,
        String targetPolicy, JsonNode snapshot, List<FrozenNoteBinding> noteBindings, List<ForecastLevel> levels) {}
    public record TargetResolution(int version, String state, LocalDate targetDay, List<String> evidence) {}
    public record Eligibility(boolean forwardEligible, List<String> reasons) {}
    public record ActualProvenance(String provider, String symbol, String adjustment, Instant fetchedAt,
                                    String candleHash, String responseHash, String responseHashKind) {}
    public record PriceEvaluation(String id, String forecastId, int version, String previousEvaluationId,
        TargetResolution targetResolution, String status, Eligibility eligibility, Candle actual,
        ActualProvenance source, PriceClosenessResult result, Instant evaluatedAt, Instant nextRetryAt, String scoreEvaluationId) {}
    public record EvaluationView(PriceEvaluation latestStatus, PriceEvaluation latestSuccessful) {}
    public record StudyImport(String sourceFile, String sourceHash, String sourceText, String sourceUrl,
        String channel, String parentRevisionId, LegacyNoteKey legacyKey, JsonNode payload) {}
    public record NoteStudyRevision(String id, String owner, String sourceFile, String sourceHash, String sourceText,
        String sourceUrl, String channel, String parentRevisionId, LegacyNoteKey legacyKey, Instant createdAt,
        String payloadHash, JsonNode payload) {}
    public record LearningSample(ForecastRecord forecast, EvaluationView evaluation) {}
    public record Page<T>(List<T> items, String nextCursor, Instant asOf) {}
    public record LearningFilters(String symbol, LocalDate anchorFrom, LocalDate anchorThrough, String method,
        String forecastDefinitionVersion, String evaluationDefinitionVersion, String directionCandidate,
        String directionConfirmed, String noteFile, String status, Boolean forwardEligible) {}
}
