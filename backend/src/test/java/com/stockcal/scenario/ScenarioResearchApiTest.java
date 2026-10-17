package com.stockcal.scenario;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static com.stockcal.scenario.ScenarioContracts.*;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class ScenarioResearchApiTest {
    @Autowired MockMvc mvc;
    @MockitoBean ScenarioRecordRepository store;
    @MockitoBean ScenarioRecordService records;
    @MockitoBean ScenarioEvaluationService evaluations;
    @MockitoBean NoteStudyService notes;
    @Test void requiresAuthenticationAndOnlyReadsOwnedRecord() throws Exception {
        mvc.perform(get("/api/v1/scenario-records")).andExpect(status().isUnauthorized());
        var record=ScenarioTestFixtures.forecast(Instant.now(),"replay");
        when(store.findOwned("alice",record.id())).thenReturn(Optional.of(record));
        mvc.perform(get("/api/v1/scenario-records/"+record.id()).with(user("alice"))).andExpect(status().isOk()).andExpect(jsonPath("$.id").value(record.id()));
        mvc.perform(get("/api/v1/scenario-records/"+record.id()).with(user("bob"))).andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/scenario-records/"+record.id()+"/evaluations").with(user("bob"))).andExpect(status().isNotFound());
    }
    @Test void invalidPayloadAndConflictKeepHttpStatus() throws Exception {
        mvc.perform(post("/api/v1/scenario-records").with(user("alice")).contentType(MediaType.APPLICATION_JSON).content("{bad"))
            .andExpect(status().isBadRequest());
        when(records.save(eq("alice"),any())).thenThrow(new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.CONFLICT,"version conflict"));
        mvc.perform(post("/api/v1/scenario-records").with(user("alice")).contentType(MediaType.APPLICATION_JSON).content("{\"snapshot\":{},\"noteBindings\":[]}"))
            .andExpect(status().isConflict());
    }
    @Test void pendingEvaluationIsSuccessfulRequestAndIdentityIsServerDerived() throws Exception {
        var empty=new EvaluationView(null,null);when(evaluations.evaluate("alice","record")).thenReturn(empty);
        mvc.perform(post("/api/v1/scenario-records/record/evaluate?owner=bob").header("X-Client-Id","pretend").with(user("alice")))
            .andExpect(status().isOk()).andExpect(jsonPath("$.latestSuccessful").isEmpty());
        verify(evaluations).evaluate("alice","record");
    }
    @Test void developmentIdentityRequiresBoundedClientIdAndPrincipalTakesPrecedence() {
        assertThat(ResearchIdentity.resolve(null,"one")).isEqualTo("web:one");
        assertThat(ResearchIdentity.resolve(()->"alice","one")).isEqualTo("alice");
        for(String id:new String[]{null,"","a".repeat(101)})assertThatThrownBy(()->ResearchIdentity.resolve(null,id)).isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
    }
}
