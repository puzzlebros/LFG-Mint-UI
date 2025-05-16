// styles/theme.ts
import { extendTheme, ThemeConfig } from "@chakra-ui/react";

const config: ThemeConfig = {
  initialColorMode:  "light",
  useSystemColorMode: false,
};

export default extendTheme({
  config,

  colors: {
    brand: {
      Pink:         "#F279A6",
      Purple:       "#6C00FF",
      DarkPurple:   "#161540",
      DarkPink:     "8C5178",
      White:        "#FFFFFF",
      Lavender:     "#5B00E04D",
      GreyPurple:   "#CAB7FF",
      gradientStart:"#93D2FF",
      gradientMid:  "#BDACFF",
      gradientEnd:  "#FFBCD5",
      bgGradient:
      "linear(to-b, brand.gradientStart 0%, brand.gradientMid 29.5%, brand.gradientEnd 100%)",
    },
  },

  fonts: {
    heading: `"Nickel Gothic Variable", sans-serif`,
    body:    `"Noto Sans", sans-serif`,
  },

  textStyles: {
    normal: {
      fontFamily:           `"Nickel Gothic Variable", sans-serif`,
      fontVariationSettings:`"wdth" 100, "slnt" 0`,
      fontWeight:           "normal",
    },
    condensed: {
      fontFamily:           `"Nickel Gothic Variable", sans-serif`,
      fontVariationSettings:`"wdth" 50, "slnt" 0`,
      fontWeight:           "normal",
      color:      "brand.DarkPurple",
    },
    narrow: {
      fontFamily:           `"Nickel Gothic Variable", sans-serif`,
      fontVariationSettings:`"wdth" 75, "slnt" 0`,
      fontWeight:           "normal",
    },
    extraCondensedOblique: {
      fontFamily:           `"Nickel Gothic Variable", sans-serif`,
      fontVariationSettings:`"wdth" 38, "slnt" -15`,
      fontWeight:           "normal",
    },
    copy: {
      fontFamily: `"Noto Sans", sans-serif`,
      fontSize:   "18px",
      fontWeight: 400,
      lineHeight: "normal",
      textAlign:  "center",
      color:      "brand.DarkPurple",
    },
    ranking: {
      fontFamily: `"Noto Sans", sans-serif`,
      fontSize:   "16px",
      fontWeight: 400,
      lineHeight: "normal",
      textAlign:  "center",
      color:      "brand.DarkPurple",
    },
  },

  components: {
    Button: {
      baseStyle: {
        borderRadius:  "0",
        color:         "white",
        fontFamily:    `"Nickel Gothic Variable", sans-serif`,
        fontWeight: "normal",
        letterSpacing: "2.5px",
        textTransform: "uppercase",
        textAlign:     "center",
      },
      sizes: {
        default: {
          h:              "40px",
          w:             "405px",
          gap:            "10px",
          justifyContent: "center",
          alignItems:     "center",
          flexShrink:     0,
          textStyle:      "narrow",
          fontSize: "1.2rem"
        },
        nav: {
          w:         "170px",
          h:         "35px",
          px:        "16px",
          textStyle: "condensed",
          fontSize: "1.3rem"
        },
      },
      variants: {
        primary: {
          bg:      "brand.Purple",
          _hover:  { bg: "brand.Lavender" },
          _active: { bg: "brand.DarkPurple" },
          _disabled: {
            bg:      "brand.Purple",
            color:   "brand.GreyPurple",
            opacity: 1,
            cursor:  "not-allowed",
          },
        },
      },
      defaultProps: {
        variant: "primary",
        size:    "default",
      },
    },
  },

  styles: {
    global: {

      "@font-face": {
        fontFamily: `"Nickel Gothic Variable"`,
        src: `url("/fonts/NickelGothicVariable[slnt,wdth].woff2") format("woff2-variations")`,
        fontWeight: "100 900",
        fontStretch: "25% 100%",
        fontStyle: "oblique 0deg 20deg",
        fontDisplay: "swap",
      },

      "html, body, #__next": {
        width:     "100%",
        height:    "100%",
        margin:    0,
        padding:   0,
        overflowX: "hidden",
      },

      body: {
        bg:    "white",
        color: "brand.DarkPurple",
      },

      // Wallet adapter button
      "button.wallet-adapter-button-trigger": {
        borderRadius:           0,
        height:              "35px",
        width:                  "200px",
        color:         "white",
        fontWeight: "normal",
        fontSize: "1.2rem",
        letterSpacing: "2.5px",
        textStyle: "condensed",
        textTransform: "uppercase",
        textAlign:     "center",
        background:             "linear-gradient(to right, #6C00FF, #5B00E04D)",
        _hover: {
          background: "linear-gradient(to right, #5B00E04D, #6C00FF)",
          transform:  "scale(1.05)",
          boxShadow:  "md",
        },
        _active: {
          transform: "scale(0.95)",
          boxShadow: "sm",
        },
      },
    },
  },
});
