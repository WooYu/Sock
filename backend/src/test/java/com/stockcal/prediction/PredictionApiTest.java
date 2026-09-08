package com.stockcal.prediction;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.stockcal.market.MarketProvider;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.json.JsonMapper;

class PredictionApiTest {
    private MockMvc mvc;

    @BeforeEach
    void setup() {
        // Market access is external; retain the real controller and projection service.
        MarketProvider provider = new MarketProvider() {
            public List<Security> search(String query) { return List.of(); }
            public MarketSnapshot snapshot(String code) {
                if (code.equals("missing")) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
                if (code.equals("offline")) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE);
                return new MarketSnapshot(null, PredictionServiceTest.history(code.equals("short") ? 19 : 20), null);
            }
        };
        mvc = MockMvcBuilders.standaloneSetup(new PredictionController(provider, new PredictionService("2026-09-07"))).build();
    }

    @Test
    void returnsThreeDailyPredictionsWithMetadataAndAllIndicators() throws Exception {
        var result = mvc.perform(get("/api/v1/market/stocks/600519/prediction?period=day"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.symbol").value("600519"))
            .andExpect(jsonPath("$.period").value("day"))
            .andExpect(jsonPath("$.days.length()").value(3))
            .andExpect(jsonPath("$.modelVersion").value("baseline-v1"))
            .andExpect(jsonPath("$.generatedAt").isNotEmpty())
            .andExpect(jsonPath("$.days[0].day").value("2026-09-08"))
            .andExpect(jsonPath("$.days[0].ma5").value(28))
            .andExpect(jsonPath("$.days[0].ma10").value(25.5))
            .andExpect(jsonPath("$.days[0].ma20").value(20.5))
            .andExpect(jsonPath("$.days[0].bollUpper").isNumber())
            .andExpect(jsonPath("$.days[0].bollMiddle").isNumber())
            .andExpect(jsonPath("$.days[0].bollLower").isNumber())
            .andExpect(jsonPath("$.days[0].rangeLow").isNumber())
            .andExpect(jsonPath("$.days[0].rangeHigh").isNumber())
            .andReturn();
        for (var day : JsonMapper.builder().build().readTree(result.getResponse().getContentAsString()).get("days")) {
            assertThat(LocalDate.parse(day.get("day").asText()).getDayOfWeek())
                .isNotIn(DayOfWeek.SATURDAY, DayOfWeek.SUNDAY);
        }
    }

    @Test
    void defaultsToDailyPeriod() throws Exception {
        mvc.perform(get("/api/v1/market/stocks/600519/prediction"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.period").value("day"));
    }

    @Test
    void insufficientHistoryReturns422AndStableErrorCode() throws Exception {
        mvc.perform(get("/api/v1/market/stocks/short/prediction?period=day"))
            .andExpect(status().isUnprocessableEntity())
            .andExpect(jsonPath("$.code").value("PREDICTION_DATA_INSUFFICIENT"));
    }

    @Test
    void rejectsNonDailyPeriodsAndInvalidSymbols() throws Exception {
        for (String period : List.of("week", "month", "year")) {
            mvc.perform(get("/api/v1/market/stocks/600519/prediction").param("period", period))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("PREDICTION_PERIOD_UNSUPPORTED"));
        }
        mvc.perform(get("/api/v1/market/stocks/bad-symbol/prediction"))
            .andExpect(status().isBadRequest());
    }

    @Test
    void preservesMarketProviderFailures() throws Exception {
        mvc.perform(get("/api/v1/market/stocks/missing/prediction")).andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/market/stocks/offline/prediction")).andExpect(status().isServiceUnavailable());
    }
}
