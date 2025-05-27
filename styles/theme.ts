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
      BrightPurple: "#9D72FF",
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
        fontSize: { base: "1rempx", md: "1.2rem" },
      },
      sizes: {
        default: {
          h:              "40px",
          w:  { base: "275px", sm: "200px", md: "375px" },
          gap:            "10px",
          justifyContent: "center",
          alignItems:     "center",
          flexShrink:     0,
          textStyle:      "narrow",
        },
        nav: {
          w: { base: "250px", md: "170px" },
          h: { base: "45px", md: "35px" },
          textStyle:  "narrow",
        },
      },
      variants: {
        primary: {
          bg:      "brand.Purple",
          _hover:  { bg: "brand.BrightPurple" },
          _active: { bg: "brand.DarkPurple" },
          _disabled: {
            bg:      "brand.GreyPurple",
            color:   "brand.Lavender",
            opacity: 1,
            cursor:  "not-allowed",
          },
        },
          // ─── NEW SECONDARY VARIANT ───
        secondary: {
          bg:            "transparent",
          border:        "2px solid",
          borderColor:   "brand.Purple",
          color:         "brand.Purple",
          _hover:        { borderColor: "brand.BrightPurple", color: "brand.BrightPurple", },
          _active:       { bg: "brand.Lavender", borderColor: "brand.DarkPurple", color: "brand.DarkPurple", },
          _disabled:     {
            borderColor: "brand.GreyPurple",
            color:       "brand.GreyPurple",
            opacity:     1,
            cursor:      "not-allowed",
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

      // ─── Wallet adapter button default ───
      "button.wallet-adapter-button-trigger-secondary": {
        borderRadius:    0,
        height:          "35px",
        width:           "200px",
        background:      "linear-gradient(to right,var(--chakra-colors-brand-Purple), var(--chakra-colors-brand-Pink))",
        color:           "white",
        /* … */
      },

      // ─── Wallet adapter button SECONDARY ───
      "button.wallet-adapter-button-trigger": {
      /* make the background transparent so our text‐gradient shows */
        borderRadius:    0,
        height: { base: "45px", md: "35px" },
        width: { base: "250px", md: "180px" },
        /* setup a gradient border */
        border:               "2px solid transparent",
        borderImageSlice:     1,
        borderImageSource:    "linear-gradient(to right, var(--chakra-colors-brand-Purple), var(--chakra-colors-brand-Pink))",

        /* text gradient */
        color:                "transparent",
        backgroundClip:       "text",
        WebkitBackgroundClip: "text",
        backgroundImage:      "linear-gradient(to right, var(--chakra-colors-brand-Purple), var(--chakra-colors-brand-Pink))",
        fontWeight: "normal",
        fontSize: { base: "1rempx", md: "1.2rem" },
        letterSpacing: "1px",
        textStyle: "narrow",
        textTransform: "uppercase",
        textAlign:     "center",

        /* hover & active can be tweaked as you like */
        _hover: {
        background:      "linear-gradient(to right,var(--chakra-colors-brand-Purple), var(--chakra-colors-brand-Pink))",
        fontWeight: "normal",
        fontSize: "1.2rem",
        letterSpacing: "2.5px",
        textStyle: "narrow",
        textTransform: "uppercase",
        textAlign:     "center",
        color: "white",
        },
        _active: {
          backgroundColor: "rgba(0,0,0,0.08)",
        },
        _disabled: {
          /* greyed out outline + solid grey text */
          borderImageSource: "linear-gradient(to right, var(--chakra-colors-brand-GreyPurple), var(--chakra-colors-brand-GreyPurple))",
          color:             "var(--chakra-colors-brand-GreyPurple)",
          opacity:           1,
          cursor:            "not-allowed",
        },
      },
    },
  },
});
