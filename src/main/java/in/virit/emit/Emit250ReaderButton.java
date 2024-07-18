package in.virit.emit;

import com.vaadin.flow.component.Composite;
import com.vaadin.flow.component.Tag;
import com.vaadin.flow.component.button.Button;
import com.vaadin.flow.component.dependency.JsModule;
import com.vaadin.flow.component.dependency.NpmPackage;
import com.vaadin.flow.component.notification.Notification;

import java.util.function.Consumer;

@NpmPackage(value = "@mikaello/emit-punch-cards-communication", version = "1.0.1")
@Tag("vaadin-button")
@JsModule("./emit-reading.ts")
public class Emit250ReaderButton extends Composite<Button> {

    private final Consumer<Ecard250Readout> ecardConsumer;

    public Emit250ReaderButton(Runnable readerReadyCallback, Consumer<Ecard250Readout> ecardConsumer) {
        this.ecardConsumer = ecardConsumer;
        getContent().setText("Connect Emit 250 Reader");

        getContent().getElement().executeJs("""
                    this.addEventListener('click', () => {
                    console.log('Clicked');
                    window.connect250();
                });
            """);

        addAttachListener(e -> {
            // Try to reconnect existing
            getContent().getElement().executeJs("""
                window.reconnect250();
                """);
            e.getUI().getElement().addEventListener("reader250-error", e1 -> {
                String msg = e1.getEventData().getString("event.detail");
                Notification.show("Error connecting to Emit 250 reader: " + msg);
            }).addEventData("event.detail");
            e.getUI().getElement().addEventListener("connect-device-250", e1 -> {
                setVisible(false); // Hide the button by default
                readerReadyCallback.run();
            });
            // ecard-readout-event
            e.getUI().getElement().addEventListener("ecard-readout-event", e1 -> {
                String jsonstr = e1.getEventData().getString("event.detail");
                Ecard250Readout ecard250 = Ecard250Readout.fromJson(jsonstr);
                ecardConsumer.accept(ecard250);
            }).addEventData("event.detail");

        });
    }

}
