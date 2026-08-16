package com.stockcal.auth;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class BearerTokenFilter extends OncePerRequestFilter {
    private final JdbcClient jdbc;

    BearerTokenFilter(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        var header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            var identity = jdbc.sql("""
                    select t.phone,u.role from access_token t
                    join app_user u on u.phone=t.phone
                    where t.token_hash = :hash and t.expires_at > :now and u.enabled=true
                    """)
                .param("hash", TokenHash.sha256(header.substring(7)))
                .param("now", OffsetDateTime.now(ZoneOffset.UTC)).query((row, ignored) ->
                    new Identity(row.getString("phone"), row.getString("role"))).optional();
            identity.ifPresent(value -> SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(value.phone(), null,
                    List.of(new SimpleGrantedAuthority("ROLE_" + value.role())))));
        }
        chain.doFilter(request, response);
    }

    private record Identity(String phone, String role) {}
}
