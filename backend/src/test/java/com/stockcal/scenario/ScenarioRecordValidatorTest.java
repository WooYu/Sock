package com.stockcal.scenario;

import static org.assertj.core.api.Assertions.*;
import static com.stockcal.scenario.ScenarioContracts.*;
import java.util.List;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

class ScenarioRecordValidatorTest {
    private final JsonMapper json = JsonMapper.builder().build();
    ObjectNode fixture() {
        return (ObjectNode)json.readTree(getClass().getResourceAsStream("/scenario/valid-day-forecast.json"));
    }
    private ScenarioRecordValidator.ValidatedForecast validate(ObjectNode snapshot) {
        return new ScenarioRecordValidator().validate(new SaveForecastRequest(snapshot,List.of()));
    }
    @Test void preservesActualParticipatingPeriods() {
        var original=fixture(); var valid=validate(original);
        assertThat(valid.symbol()).isEqualTo("603533");
        assertThat(valid.request().snapshot().path("input").path("periods").size()).isEqualTo(1);
        assertThat(valid.method()).isEqualTo("rolling_close");
        assertThat(original.path("input").path("periods").has("60m")).isFalse();
    }
    @Test void rejectsFutureClosedBarsAndForeignSymbol() {
        var future=fixture(); ((ObjectNode)future.path("input")).put("asOf","2026-10-08T00:00:00Z");
        assertThatThrownBy(() -> validate(future)).isInstanceOf(IllegalArgumentException.class);
        var foreign=fixture(); ((ObjectNode)foreign.path("input").path("periods").path("day")).put("symbol","600519");
        assertThatThrownBy(() -> validate(foreign)).isInstanceOf(IllegalArgumentException.class);
        var adjusted=fixture(); ((ObjectNode)adjusted.path("input").path("periods").path("day")).put("adjustment","qfq");
        assertThatThrownBy(() -> validate(adjusted)).isInstanceOf(IllegalArgumentException.class);
    }
    @Test void rejectsChangedMergeOrLadder() {
        var merged=fixture(); ((ObjectNode)merged.path("mergedLevels").get(0)).put("value",1000);
        assertThatThrownBy(() -> validate(merged)).isInstanceOf(IllegalArgumentException.class);
        var ladder=fixture(); var price=ladder.path("dailyPriceLadder").path("down").get(0);
        ((ObjectNode)price).put("value",1000);
        assertThatThrownBy(() -> validate(ladder)).isInstanceOf(IllegalArgumentException.class);
        var selected=fixture();((ObjectNode)selected.path("consolidation")).put("method","invented");
        assertThatThrownBy(() -> validate(selected)).isInstanceOf(IllegalArgumentException.class);
    }
    @Test void requestHashIgnoresObjectOrderButNotChangedPrice() {
        var one=fixture(); var reversed=json.createObjectNode();
        var entries=new java.util.ArrayList<>(one.properties());java.util.Collections.reverse(entries);
        for(var e:entries)reversed.set(e.getKey(),e.getValue());
        assertThat(validate(one).payloadHash()).isEqualTo(validate(reversed).payloadHash());
        reversed.put("id","another");
        assertThat(validate(one).payloadHash()).isNotEqualTo(validate(reversed).payloadHash());
    }
    @Test void rejectsDemoAndDuplicateReference() {
        var demo=fixture();((ObjectNode)demo.path("input")).put("sourceMode","demo");
        assertThatThrownBy(() -> validate(demo)).isInstanceOf(IllegalArgumentException.class);
        var dup=fixture();((tools.jackson.databind.node.ArrayNode)dup.path("references")).add(dup.path("references").get(0));
        assertThatThrownBy(() -> validate(dup)).isInstanceOf(IllegalArgumentException.class);
    }
}
