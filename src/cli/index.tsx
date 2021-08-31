import { useState, useEffect } from "react";
import { render, Text, useInput } from "ink";

function Main() {
  // const [text, setText] = useState<String[]>([]);

  // useEffect(() => {
  //   const interval = setInterval(() => {
  //     setText((oldText) => [...oldText, "Hello World!"]);
  //   }, 1000);

  //   return () => clearInterval(interval);
  // }, [setText]);

  useInput((input, key) => {
    console.log(input);
  });

  return (
    <>
      <Text>
        <Text bold>/hello/world</Text> "this" "is" "a" "test" 1 2 3 4 5 6 7 8 9
        10 "hello everyone!"
      </Text>
    </>
  );
}

render(<Main />);
