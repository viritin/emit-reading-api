package in.virit.emit;

import java.util.List;

public record EcardReadoutEvent(
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
}