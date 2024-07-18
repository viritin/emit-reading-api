package in.virit.emit;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.List;

public record Ecard250Readout(
    int ecardNumber,
    int ecardProductionWeek,
    int ecardProductionYear,
    boolean validEcardCheckByte,
    List<ControlCode> controlCodes,
    String emitTimeSystemString,
    String disp1,
    String disp2,
    String disp3,
    boolean validTransferCheckByte,
    boolean finishedReading
) {
    private static final ObjectMapper objectMapper = new ObjectMapper();
    public static Ecard250Readout fromJson(String json) {
        try {
            return objectMapper.readValue(json, Ecard250Readout.class);
        } catch (JsonProcessingException e) {
            throw new RuntimeException(e);
        }
    }
}