package com.stockcal.auth;

public interface SmsGateway {
    void sendCode(String phone, String code);
}
