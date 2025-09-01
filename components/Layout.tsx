// components/Layout.tsx
import { Flex, Box } from "@chakra-ui/react";
import Navbar from "./Navbar";

type LayoutProps = { children: React.ReactNode };

export default function Layout({ children }: LayoutProps) {
  return (
    <Flex direction="column" h="100%" w="100%">
      {/* Navbar sizes itself by its own padding/content */}
      <Navbar />

      {/* This main flex:1 container will fill everything under the Navbar */}
      {/* minH=0 is critical to allow its children to shrink/grow properly */}
      <Box as="main" flex="1" minH="0" overflow="hidden">
        {children}
      </Box>
    </Flex>
  );
}
