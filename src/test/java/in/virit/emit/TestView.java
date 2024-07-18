package in.virit.emit;

import com.vaadin.flow.component.html.H1;
import com.vaadin.flow.component.notification.Notification;
import com.vaadin.flow.component.orderedlayout.VerticalLayout;
import com.vaadin.flow.router.Route;
import org.vaadin.firitin.components.grid.VGrid;

import java.util.ArrayList;
import java.util.List;

@Route
public class TestView extends VerticalLayout {

    VGrid<Ecard250Readout> grid = new VGrid<>(Ecard250Readout.class);

    List<Ecard250Readout> readouts = new ArrayList<>();

    public TestView() {
        add(new H1("Hello Emit!"));
        Emit250ReaderButton emit250ReaderButton = new Emit250ReaderButton(
                () -> Notification.show("Reader ready!"),
                ecard -> {
                    readouts.add(0, ecard);
                    grid.setItems(readouts);
                });
        add(emit250ReaderButton);
        add(grid);
    }
}
