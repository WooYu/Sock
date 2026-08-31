package com.stockcal.account;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.security.Principal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/v1/account")
public class AccountPortfolioController {
    private final JdbcClient jdbc;

    AccountPortfolioController(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @PostMapping("/trades")
    @Transactional
    TradeView saveTrade(
            Principal principal,
            @RequestHeader(value = "X-Client-Id", required = false) String clientId,
            @Valid @RequestBody TradeRequest request) {
        var userId = identity(principal, clientId);
        var side = request.side().toLowerCase();
        if (!side.equals("buy") && !side.equals("sell")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "side must be buy or sell");
        }
        var current = jdbc.sql("""
                select revision from account_trade where user_id=:userId and id=:id
                """)
            .param("userId", userId).param("id", request.id())
            .query(Long.class).optional().orElse(null);
        if (current != null && request.revision() <= current) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "revision conflict");
        }
        if (current == null) {
            jdbc.sql("""
                    insert into account_trade
                    (id,user_id,symbol,side,quantity,price,fee,traded_at,note,revision)
                    values (:id,:userId,:symbol,:side,:quantity,:price,:fee,:tradedAt,:note,:revision)
                    """)
                .param("id", request.id()).param("userId", userId)
                .param("symbol", request.symbol()).param("side", side)
                .param("quantity", request.quantity()).param("price", request.price())
                .param("fee", request.fee()).param("tradedAt", Timestamp.from(request.tradedAt()))
                .param("note", request.note()).param("revision", request.revision()).update();
        } else {
            jdbc.sql("""
                    update account_trade set symbol=:symbol, side=:side, quantity=:quantity,
                    price=:price, fee=:fee, traded_at=:tradedAt, note=:note,
                    revision=:revision, updated_at=current_timestamp
                    where user_id=:userId and id=:id
                    """)
                .param("id", request.id()).param("userId", userId)
                .param("symbol", request.symbol()).param("side", side)
                .param("quantity", request.quantity()).param("price", request.price())
                .param("fee", request.fee()).param("tradedAt", Timestamp.from(request.tradedAt()))
                .param("note", request.note()).param("revision", request.revision()).update();
        }
        return new TradeView(request.id(), request.symbol(), side, request.quantity(),
            request.price(), request.fee(), request.tradedAt(), request.note(), request.revision());
    }

    @GetMapping("/portfolio")
    PortfolioResponse portfolio(
            Principal principal,
            @RequestHeader(value = "X-Client-Id", required = false) String clientId) {
        var userId = identity(principal, clientId);
        var trades = jdbc.sql("""
                select id,symbol,side,quantity,price,fee,traded_at,note,revision
                from account_trade where user_id=:userId order by traded_at, id
                """)
            .param("userId", userId).query(this::mapTrade).list();
        return new PortfolioResponse(trades, calculateHoldings(trades));
    }

    private String identity(Principal principal, String clientId) {
        if (principal != null) return principal.getName();
        if (clientId == null || clientId.isBlank() || clientId.length() > 100) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "X-Client-Id is required");
        }
        return "web:" + clientId;
    }

    private TradeView mapTrade(ResultSet row, int ignored) throws SQLException {
        return new TradeView(
            row.getString("id"), row.getString("symbol"), row.getString("side"),
            row.getBigDecimal("quantity"), row.getBigDecimal("price"),
            row.getBigDecimal("fee"), row.getTimestamp("traded_at").toInstant(),
            row.getString("note"), row.getLong("revision"));
    }

    private List<HoldingView> calculateHoldings(List<TradeView> trades) {
        var positions = new LinkedHashMap<String, Position>();
        for (var trade : trades) {
            var position = positions.computeIfAbsent(trade.symbol(), ignored -> new Position());
            var signedQuantity = trade.side().equals("buy")
                ? trade.quantity() : trade.quantity().negate();
            var signedCost = trade.side().equals("buy")
                ? trade.quantity().multiply(trade.price())
                : trade.quantity().multiply(trade.price()).negate();
            position.quantity = position.quantity.add(signedQuantity);
            position.cost = position.cost.add(signedCost);
        }
        var result = new ArrayList<HoldingView>();
        positions.forEach((symbol, position) -> {
            if (position.quantity.compareTo(BigDecimal.ZERO) != 0) {
                var average = position.cost.divide(position.quantity, 6, java.math.RoundingMode.HALF_UP);
                result.add(new HoldingView(symbol, position.quantity, average));
            }
        });
        return result;
    }

    private static final class Position {
        private BigDecimal quantity = BigDecimal.ZERO;
        private BigDecimal cost = BigDecimal.ZERO;
    }
}

record TradeRequest(
    @NotBlank @Size(max = 180) String id,
    @NotBlank @Size(max = 32) String symbol,
    @NotBlank String side,
    @NotNull @DecimalMin("0.000001") BigDecimal quantity,
    @NotNull @DecimalMin("0.000001") BigDecimal price,
    @NotNull @DecimalMin("0") BigDecimal fee,
    @NotNull Instant tradedAt,
    @Size(max = 2000) String note,
    @Min(1) long revision) {}

record TradeView(
    String id, String symbol, String side, BigDecimal quantity, BigDecimal price,
    BigDecimal fee, Instant tradedAt, String note, long revision) {}

record HoldingView(String symbol, BigDecimal quantity, BigDecimal averageCost) {}

record PortfolioResponse(List<TradeView> trades, List<HoldingView> holdings) {}
