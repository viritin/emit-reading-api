package in.virit.emit;

import com.vaadin.flow.component.Composite;
import com.vaadin.flow.component.Tag;
import com.vaadin.flow.component.button.Button;
import com.vaadin.flow.component.dependency.JavaScript;
import com.vaadin.flow.component.dependency.JsModule;
import com.vaadin.flow.component.dependency.NpmPackage;
import com.vaadin.flow.component.notification.Notification;
import com.vaadin.flow.dom.DomListenerRegistration;
import com.vaadin.flow.shared.Registration;
import org.vaadin.addons.velocitycomponent.VElement;

import java.util.Arrays;
import java.util.function.Consumer;

@NpmPackage(value = "@mikaello/emit-punch-cards-communication", version = "1.0.1")
@Tag("vaadin-button")
@JsModule("./emit-reading.ts")
public class Emit250ReaderButton extends Composite<Button> {

    private final Consumer<Ecard250Readout> ecardConsumer;

    public Emit250ReaderButton(Runnable readerReadyCallback, Consumer<Ecard250Readout> ecardConsumer) {
        this.ecardConsumer = ecardConsumer;
        getContent().setText("Connect Emit 250 Reader");

        getContent().addClickListener(e -> {
            getContent().getElement().executeJs("window.connect250();");
        });

        addAttachListener(e -> {
            // Try to reconnect (existing grant to a port)
            getContent().getElement().executeJs("""
                window.reconnect250();
            """);
            var errorReg = VElement.body().on("reader250-error", String.class, msg -> {
                if(msg.contains("port is already open")) {
                    setVisible(false); // Hide the button by default
                    readerReadyCallback.run();
                } else {
                    Notification.show("Error connecting to Emit 250 reader: " + msg);
                }
            });
            var connectedReg = e.getUI().getElement().addEventListener("connect-device-250", e1 -> {
                setVisible(false); // Hide the button by default
                readerReadyCallback.run();
            });
            // ecard-readout-event
            var readOutReg = VElement.body().on(Ecard250Readout.class, ecard250 -> {
                ecardConsumer.accept(ecard250);
            });
            addDetachListener(detachEvent -> {
                Arrays.asList(errorReg, connectedReg, readOutReg).forEach(Registration::remove);
            });
        });

    }

}
