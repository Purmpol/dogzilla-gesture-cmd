import { MessageEvent, PanelExtensionContext, SettingsTreeAction } from "@foxglove/extension";
import { CompressedImage } from "@foxglove/schemas";
import { MobiledataOff, Send } from "@mui/icons-material";
import { Button, FormControlLabel, Switch } from "@mui/material";
import { produce } from "immer";
import { set } from "lodash";
import { useEffect, useLayoutEffect, useState, useCallback, ReactElement, useRef } from "react";
import { createRoot } from "react-dom/client";

// This is the type of state we will use to render the panel and also
// persist to the layout.
type State = {
  generalConfig: {
    inputImgTopic: number;
    outputImgTopic: string;
    cmdMode: string;
    // enLookup: boolean;
  };
  handLmColors: {
    lineColorSelect: string;
    dotColorSelect: string;
  };
  cmdList: {
    zero: number;
    one: number;
    two: number;
    three: number;
    four: number;
    five: number;
  };
};

const cmdOptions = [
  { value: 255, label: "Reset" },
  { value: 12, label: "Sit Down" },
  { value: 19, label: "Handshake" },
  { value: 5, label: "Mark Time" },
  { value: 10, label: "3 Axis" },
  { value: 4, label: "Turn Around" },
];

const cmdModeOptions = [
  { value: "user-confirm", label: "User Confirmation" },
  { value: "free-run", label: "Free Running" },
];

type ImageMessage = MessageEvent<CompressedImage>;
type StringMessage = { data: string };

// Draws the compressed image data into our canvas.
async function drawImageOnCanvas(imgData: Uint8Array, canvas: HTMLCanvasElement, format: string) {
  const ctx = canvas.getContext("2d");
  if (ctx == undefined) {
    return;
  }

  // Create a bitmap from our raw compressed image data.
  const blob = new Blob([imgData], { type: `image/${format}` });
  const bitmap = await createImageBitmap(blob);

  // Adjust for aspect ratio.
  canvas.width = Math.round((canvas.height * bitmap.width) / bitmap.height);

  // Draw the image.
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  ctx.resetTransform();
}

function ExamplePanel({ context }: { context: PanelExtensionContext }): ReactElement {
  // const [topics, setTopics] = useState<undefined | Immutable<Topic[]>>();
  // const [messages, setMessage] = useState<undefined | Immutable<MessageEvent[]>>();
  const [message, setMessage] = useState<ImageMessage>();

  const [renderDone, setRenderDone] = useState<(() => void) | undefined>();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const currenGestureRef = useRef<string | undefined>(undefined);
  const noGestureCountRef = useRef<number>(0);
  const [isEnable, setIsEnable] = useState(false);
  const [isLookup, setIsLookup] = useState(false);

  // Build our panel state from the context's initialState, filling in any possibly missing values.
  const [state, setState] = useState<State>(() => {
    const partialState = (context.initialState ?? {}) as Partial<State>;
    return {
      generalConfig: {
        inputImgTopic: partialState.generalConfig?.inputImgTopic ?? 0,
        outputImgTopic:
          partialState.generalConfig?.outputImgTopic ?? "/dogzilla/image_gesture/compressed",
        cmdMode: partialState.generalConfig?.cmdMode ?? "User Confirmation",
        // enLookup: partialState.generalConfig?.enLookup ?? false,
      },
      handLmColors: {
        lineColorSelect: partialState.handLmColors?.lineColorSelect ?? "#00FF00",
        dotColorSelect: partialState.handLmColors?.dotColorSelect ?? "#FF0000",
      },
      cmdList: {
        zero: partialState.cmdList?.zero ?? Number(cmdOptions[0]?.value),
        one: partialState.cmdList?.one ?? Number(cmdOptions[1]?.value),
        two: partialState.cmdList?.two ?? Number(cmdOptions[2]?.value),
        three: partialState.cmdList?.three ?? Number(cmdOptions[3]?.value),
        four: partialState.cmdList?.four ?? Number(cmdOptions[4]?.value),
        five: partialState.cmdList?.five ?? Number(cmdOptions[5]?.value),
      },
    };
  });

  function gestureToCmd(gestureMsg: string | undefined): string {
    let cmd: string | undefined = "";
    switch (gestureMsg) {
      case "Zero":
        cmd = cmdOptions.find((c) => c.value === state.cmdList.zero)?.label;
        break;
      case "One":
        cmd = cmdOptions.find((c) => c.value === state.cmdList.one)?.label;
        break;
      case "Two":
        cmd = cmdOptions.find((c) => c.value === state.cmdList.two)?.label;
        break;
      case "Three":
        cmd = cmdOptions.find((c) => c.value === state.cmdList.three)?.label;
        break;
      case "Four":
        cmd = cmdOptions.find((c) => c.value === state.cmdList.four)?.label;
        break;
      case "Five":
        cmd = cmdOptions.find((c) => c.value === state.cmdList.five)?.label;
        break;
      case undefined:
        cmd = "[No Command]";
        break;
      default:
        cmd = "[No Command]";
    }
    return cmd ?? "[No Command]";
  }

  // Respond to actions from the settings editor to update our state.
  const actionHandler = useCallback((action: SettingsTreeAction) => {
    if (action.action === "update") {
      const { path, value } = action.payload;
      // We use a combination of immer and lodash to produce a new state object so react will
      // re-render our panel. Because our data node contains a label & and visibility property
      // this will handle editing the label and toggling the node visibility without any special
      // handling.
      setState(produce((draft) => set(draft, path, value)));

      // // If the topic was changed update our subscriptions.
      // if (path[1] === "topic") {
      //   context.subscribe([{ topic: value as string }]);
      // }
    }
  }, []);

  // Update the settings editor every time our state or the list of available topics changes.
  useEffect(() => {
    context.saveState(state);

    // We set up our settings tree to mirror the shape of our panel state so we
    // can use the paths to values from the settings tree to directly update our state.
    context.updatePanelSettingsEditor({
      actionHandler,
      nodes: {
        generalConfig: {
          // Our label comes from the label in our state and will update to reflect changes to the
          // value in state.
          label: "General Config",
          icon: "Cube",
          fields: {
            inputImgTopic: {
              label: "Input Image Topic",
              input: "toggle",
              value: state.generalConfig.inputImgTopic,
              options: [
                { value: 0, label: "Foxglove" },
                { value: 1, label: "Robot" },
              ],
            },
            outputImgTopic: {
              label: "Output Image Topic",
              input: "string",
              value: state.generalConfig.outputImgTopic,
              disabled: true,
            },
            cmdMode: {
              label: "Command Mode",
              input: "select",
              value: state.generalConfig.cmdMode,
              options: cmdModeOptions,
            },
            // enLookup: {
            //   label: "Enable Look up",
            //   input: "boolean",
            //   value: state.generalConfig.enLookup,
            // },
          },
        },
        handLmColors: {
          label: "Hand Landmark Colors",
          icon: "Points",
          fields: {
            lineColorSelect: {
              label: "Line",
              input: "rgb",
              value: state.handLmColors.lineColorSelect,
            },
            dotColorSelect: {
              label: "Dot",
              input: "rgb",
              value: state.handLmColors.dotColorSelect,
            },
          },
        },
        cmdList: {
          label: "Commands",
          icon: "Shapes",
          fields: {
            zero: {
              label: "Zero",
              input: "select",
              value: state.cmdList.zero,
              options: cmdOptions,
            },
            one: {
              label: "One",
              input: "select",
              value: state.cmdList.one,
              options: cmdOptions,
            },
            two: {
              label: "Two",
              input: "select",
              value: state.cmdList.two,
              options: cmdOptions,
            },
            three: {
              label: "Three",
              input: "select",
              value: state.cmdList.three,
              options: cmdOptions,
            },
            four: {
              label: "Four",
              input: "select",
              value: state.cmdList.four,
              options: cmdOptions,
            },
            five: {
              label: "Five",
              input: "select",
              value: state.cmdList.five,
              options: cmdOptions,
            },
          },
        },
      },
    });
  }, [context, actionHandler, state]);

  // We use a layout effect to setup render handling for our panel. We also setup some topic subscriptions.
  useLayoutEffect(() => {
    // The render handler is run by the broader studio system during playback when your panel
    // needs to render because the fields it is watching have changed. How you handle rendering depends on your framework.
    // You can only setup one render handler - usually early on in setting up your panel.
    //
    // Without a render handler your panel will never receive updates.
    //
    // The render handler could be invoked as often as 60hz during playback if fields are changing often.
    context.onRender = (renderState, done) => {
      // render functions receive a _done_ callback. You MUST call this callback to indicate your panel has finished rendering.
      // Your panel will not receive another render callback until _done_ is called from a prior render. If your panel is not done
      // rendering before the next render call, studio shows a notification to the user that your panel is delayed.
      //
      // Set the done callback into a state variable to trigger a re-render.
      setRenderDone(() => done);

      // We may have new topics - since we are also watching for messages in the current frame, topics may not have changed
      // It is up to you to determine the correct action when state has not changed.
      // setTopics(renderState.topics);

      // // currentFrame has messages on subscribed topics since the last render call
      // if (renderState.currentFrame) {
      //   setMessages(renderState.currentFrame);
      // }

      // Save the most recent message on our image topic.
      if (renderState.currentFrame && renderState.currentFrame.length > 0) {
        setMessage(renderState.currentFrame[renderState.currentFrame.length - 1] as ImageMessage);
      }

      // Save the most recent message on the gesture topic.
      const gestureMsg = (renderState.currentFrame
        ?.filter((msgEvent) => msgEvent.topic === "/dogzilla/pub_gesture/gesture")
        .map((messageEvent) => messageEvent.message) ?? []) as StringMessage[];

      if (gestureMsg[gestureMsg.length - 1]?.data != undefined) {
        currenGestureRef.current = gestureMsg[gestureMsg.length - 1]?.data ?? undefined;
      } else {
        if (gestureMsg.length === 0) {
          noGestureCountRef.current++;
          if (noGestureCountRef.current >= 50) {
            currenGestureRef.current = "";
            noGestureCountRef.current = 0;
          }
        } else {
          noGestureCountRef.current = 0;
        }
      }
    };

    // After adding a render handler, you must indicate which fields from RenderState will trigger updates.
    // If you do not watch any fields then your panel will never render since the panel context will assume you do not want any updates.

    // tell the panel context that we care about any update to the _topic_ field of RenderState
    context.watch("topics");

    // tell the panel context we want messages for the current frame for topics we've subscribed to
    // This corresponds to the _currentFrame_ field of render state.
    context.watch("currentFrame");

    // Subscribe to our initial topic.
    if (state.generalConfig.outputImgTopic) {
      context.subscribe([
        { topic: state.generalConfig.outputImgTopic },
        { topic: "/dogzilla/pub_gesture/gesture" },
      ]);
    }

    context.setParameter("/hand_gesture.gesture_colors", [
      state.handLmColors.lineColorSelect,
      state.handLmColors.dotColorSelect,
    ]);
  }, [
    context,
    state.handLmColors.lineColorSelect,
    state.handLmColors.dotColorSelect,
    state.generalConfig.outputImgTopic,
    currenGestureRef,
    // state.generalConfig.enLookup,
  ]);

  useEffect(() => {
    if (context.callService) {
      void context
        .callService("/set_robot_cam", { data: state.generalConfig.inputImgTopic !== 0 })
        .catch((error: unknown) => {
          console.error(error);
        });
    }
  }, [context, state.generalConfig.inputImgTopic]);

  useEffect(() => {
    context.setParameter("/sub_perform.enable", isEnable);
  }, [context, isEnable]);

  useEffect(() => {
    context.setParameter(
      "/sub_perform.is_free_running",
      state.generalConfig.cmdMode === "free-run",
    );
  }, [context, state.generalConfig.cmdMode]);

  useEffect(() => {
    const cmd_order = [
      state.cmdList.zero,
      state.cmdList.one,
      state.cmdList.two,
      state.cmdList.three,
      state.cmdList.four,
      state.cmdList.five,
    ];
    context.setParameter("/sub_perform.cmd_order", cmd_order);
  }, [
    context,
    state.cmdList.five,
    state.cmdList.four,
    state.cmdList.one,
    state.cmdList.three,
    state.cmdList.two,
    state.cmdList.zero,
  ]);

  // Every time we get a new image message draw it to the canvas.
  useEffect(() => {
    if (message) {
      drawImageOnCanvas(message.message.data, canvasRef.current!, message.message.format).catch(
        (error: unknown) => {
          console.log(error);
        },
      );
    }
  }, [message]);

  // invoke the done callback once the render is complete
  useEffect(() => {
    renderDone?.();
  }, [renderDone]);

  return (
    <div style={{ width: "100%", padding: "1rem", display: "flex", flexDirection: "column" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          width: "100%",
        }}
      >
        <FormControlLabel
          control={
            <Switch
              value={isEnable}
              onChange={() => {
                setIsEnable(!isEnable);
              }}
            />
          }
          label="Enable Robot Action"
        />
        <text>
          {cmdModeOptions.find((option) => option.value === state.generalConfig.cmdMode)?.label}
        </text>
      </div>
      <canvas
        ref={canvasRef}
        width={canvasRef.current?.clientWidth}
        height={canvasRef.current?.clientHeight}
      />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          width: "100%",
        }}
      >
        <Button
          variant="outlined"
          startIcon={<MobiledataOff />}
          style={{ height: 50, margin: 20 }}
          onClick={() => {
            if (context.callService) {
              void context.callService("/en_lookup", { data: isLookup }).catch((error: unknown) => {
                console.error(error);
              });
              setIsLookup(!isLookup);
            }
          }}
        >
          {isLookup ? "Look Up" : "Normal Posture"}
        </Button>
        <Button
          variant="contained"
          startIcon={<Send />}
          style={{ height: 50, margin: 20, width: "50%" }}
          onClick={() => {
            if (context.callService) {
              void context
                .callService("/action_trigger", { gesture: currenGestureRef.current })
                .catch((error: unknown) => {
                  console.error(error);
                });
            }
          }}
        >
          {gestureToCmd(currenGestureRef.current)}
        </Button>
      </div>
    </div>
  );
}

export function initExamplePanel(context: PanelExtensionContext): () => void {
  const root = createRoot(context.panelElement);
  root.render(<ExamplePanel context={context} />);

  // Return a function to run when the panel is removed
  return () => {
    root.unmount();
  };
}
