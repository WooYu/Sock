package com.stockcal.auth;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.Instant;
import java.util.List;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
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
            var phone = jdbc.sql("""
                    select phone from access_token
                    where token_hash = :hash and expires_at > :now
                    """)
                .param("hash", TokenHash.sha256(header.substring(7)))
                .param("now", Instant.now()).query(String.class).optional();
            phone.ifPresent(value -> SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(value, null, List.of())));
        }
        chain.doFilter(request, response);
    }
}
