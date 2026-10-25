package com.stockcal.scenario;
import java.security.Principal;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
final class ResearchIdentity {
    private ResearchIdentity(){}
    static String resolve(Principal principal,String clientId) {
        if(principal!=null)return "shared";
        if(clientId==null || clientId.isBlank() || clientId.length()>100)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"X-Client-Id is required");
        return "shared";
    }
}
