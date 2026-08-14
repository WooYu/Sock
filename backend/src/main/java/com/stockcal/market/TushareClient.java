package com.stockcal.market;

import java.util.List;
import java.util.Map;

interface TushareClient {
    List<Map<String, Object>> query(String api, Map<String, String> params, List<String> fields);
}
