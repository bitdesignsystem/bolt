<?php

namespace Bolt;

use Bolt;
use \Twig_SimpleFunction;
use \Drupal\Core\Template\Attribute;
use \BasaltInc\TwigTools;
use \Webmozart\PathUtil\Path;
use Symfony\Component\Process\Process;
use Symfony\Component\Process\Exception\ProcessFailedException;

// https://github.com/Shudrum/ArrayFinder
use \Shudrum\Component\ArrayFinder\ArrayFinder;

class TwigFunctions {

  public static function getSpacingScaleSequence() {
    return new Twig_SimpleFunction('getSpacingScaleSequence', function($context) {
      // Mainly just a demo for how to access the global `bolt` data.
      $data = $context['bolt']['data']['spacing']['scale'];
      $scaleValues = array_values($data);
      sort($scaleValues);
      return $scaleValues;
    }, [
      'needs_context' => true,
    ]);
  }


  public static function fileExists() {
    return new Twig_SimpleFunction('fileExists', function(\Twig_Environment $env, $context, $path) {
      $result = '';

      try {
        $full_path = is_file($path) ? $path : Bolt\Utils::optionallyResolveTwigPath($env, $path);

        if (file_exists($full_path)) {
          $result = true;
        }
      } catch (\Exception $e) {
        $result = false;
      }
      return $result;
    }, [
      'needs_environment' => true,
      'needs_context' => true,
    ]);
  }

  public static function bolt_ssr($context, $html) {
    // a better, more dynamic way of finding the ssr-server path is via lerna (but it's more costly to run $$)
    // $p = new Process('npx --quiet lerna ls --json --all | npx --quiet json -a -c "this.name === \'@bolt/ssr-server\'" location');
    // $p->run();
    // $ssrServerPath = trim($p->getOutput()).'/index.mjs';

    // locate where the Bolt SSR Server script is physically located so we can call the script + pass along our HTML string to render
    $context = new ArrayFinder($context);
    $configFileUsed = $context->get('bolt.data.config.configFileUsed');
    
    $ssrServerPath = dirname($configFileUsed, 2) . '/node_modules/@bolt/ssr-server/index.mjs';
    $ssrServerPathAlt = dirname($configFileUsed, 1) . '/node_modules/@bolt/ssr-server/index.mjs';
    $ssrServerLocation = '';

    // if we found the right SSR server file in one of two places, try to render using it. Otherwise return the original HTML.
    if (file_exists( $ssrServerPath )){
      $ssrServerLocation = $ssrServerPath; // SSR file to use for rendering found in the node_modules folder located at the same level as .boltrc config
    } elseif (file_exists( $ssrServerPathAlt )){
      $ssrServerLocation = $ssrServerPathAlt; // SSR file to use for rendering found one level higher than the .boltrc config
    } else {
      return $html; // if the ssr-server can't be found 
    }

    // alt way of handling this natively without the esm module
    // $process = new Process(['node', '--experimental-modules', '--no-warnings', $ssrServerPath, $html]); // without npx lerna: 12.7s, 12.8s
    $process = new Process(['node', '-r', 'esm', $ssrServerLocation, $html]); // without npx lerna: 12.9s, 12.5s, 15.2s

    $process->setTimeout(3600);
    $process->setIdleTimeout(240);
    $process->run();
    return $process->getOutput();
  }

  public static function ssr() {
    return new Twig_SimpleFunction('bolt_ssr', function(\Twig_Environment $env, $context, $html) {
      $result = self::bolt_ssr($context, $html);
      return $result;
    }, [
      'needs_environment' => true,
      'needs_context' => true,
    ]);
  }


  public static function inlineFile() {
    return new Twig_SimpleFunction('inline', function($context, $filename) {
      if (!$filename){
        return '';
      }

      $context = new ArrayFinder($context);
      $buildDir = $context->get('bolt.data.config.buildDir');
      $wwwDir = $context->get('bolt.data.config.wwwDir');

      if ($buildDir) {
        $fullBuildDir = Path::join($buildDir, $filename);
        $fullWwwDir = Path::join($wwwDir, $filename);

        // Look in a few places before giving up
        if (file_exists($fullBuildDir)){ // Check the build directory
          return file_get_contents($fullBuildDir);

        } elseif (file_exists($fullWwwDir)) { // Check the wwwDir
          return file_get_contents($fullWwwDir);

        } elseif (file_exists($filename)) { // As a last resort, check to make sure the filename path can't be resolved as-is
          return file_get_contents($filename);

        } else {
          throw new \Exception('Warning: the file ' . $filename . ' trying to be inlined doesn\'t seem to exist...');
        }
      } else {
        // throw error saying `bolt.data` isn't set up right
        throw new \Exception('Warning: the Bolt Build directory, `' . $buildDir . '` , appears to be missing. Is your `.boltrc` config set up properly?');
      }
    }, [
      'needs_context' => true,
    ]);
  }

  // @todo: integrate with existing Link component
  // Better Link function - improvement over off the shelf Drupal `Link` function Pattern Lab's Twig Extensions Plugin provided.
  public static function link() {
    return new Twig_SimpleFunction('link', function ($title, $url, $attributes) {
      if (!empty($attributes)) {
        if (is_array($attributes)) {
          $attributes = new Attribute($attributes);
        }
        return '<a href="' . $url . '"' . $attributes . '>' . $title . '</a>';
      } else {
        return '<a href="' . $url . '">' . $title . '</a>';
      }
    }, array('is_safe' => array('html')));
  }

  // A combination of base64, bgcolor, ratio, and imageSize
  public static function getImageData() {
    return new Twig_SimpleFunction('getImageData', function(\Twig_Environment $env, $relativeImagePath) {
      if (!$relativeImagePath) {
        return [];
      }
      try {
        $boltData = Utils::getData($env);
        $wwwDir = $boltData['config']['wwwDir'];
        return Images::get_image_data($relativeImagePath, $wwwDir);
      } catch (\Exception $exception) {
        // There's a ton of permutations to be accounted for, we've got most covered, but not all.
        // We can't have something going wrong throwing an Exception: causes white screen of death in Drupal.
        // For now, if we can't figure out image data, we just return `[]`.
        return [];
      }
    }, [
      'needs_environment' => true,
    ]);
  }

  // Same overall idea as https://jmperezperez.com/medium-image-progressive-loading-placeholder/, we just started working on this a few years prior ^_^
  public static function base64() {
    return new Twig_SimpleFunction('base64', function(\Twig_Environment $env, $relativeImagePath) {
      $boltData = Utils::getData($env);
      $wwwDir = $boltData['config']['wwwDir'];
      return Images::generate_base64_image_placeholder($relativeImagePath, $wwwDir);
    }, [
      'needs_environment' => true,
    ]);
  }


  // Return the average color of the image path passed in
  public static function bgcolor() {
    return new Twig_SimpleFunction('bgcolor', function(\Twig_Environment $env, $relativeImagePath) {
      $boltData = Utils::getData($env);
      $wwwDir = $boltData['config']['wwwDir'];
      return Images::calculate_average_image_color($relativeImagePath, $wwwDir);
    }, [
      'needs_environment' => true,
    ]);
  }

  // Return the aspect ratio of the image passed in
  public static function ratio() {
    return new Twig_SimpleFunction('ratio', function(\Twig_Environment $env, $relativeImagePath, $heightOrWidthRatio = 'width') {
      $boltData = Utils::getData($env);
      $wwwDir = $boltData['config']['wwwDir'];
      $value = Images::calculate_image_aspect_ratio($relativeImagePath, $heightOrWidthRatio, $wwwDir);
      return $value;
    }, [
      'needs_environment' => true,
    ]);
  }


  // Originally was required...? Keeping for now till full responsive images solution back up and running
  public static function imagesize() {
    return new Twig_SimpleFunction('imagesize', function(\Twig_Environment $env, $relativeImagePath) {
      $boltData = Utils::getData($env);
      $wwwDir = $boltData['config']['wwwDir'];
      return Images::get_image_dimensions($relativeImagePath, $wwwDir);
    }, [
      'needs_environment' => true,
    ]);
  }


  public static function deep_merge() {
    return new Twig_SimpleFunction('deep_merge', function($param1, $param2) {
      $result = array_merge_recursive( $param1, $param2 );
      // $result = array_replace_recursive( $param1, $param2 );
      return $result;
    });
  }

  // @todo: rename to public_path? we should also look into what'd be required to support `drupal_get_path`
  public static function publicpath() {
    return new Twig_SimpleFunction('publicpath', function($fileName) {
      if (function_exists('drupal_get_path')) {
        return '/' . drupal_get_path('theme', 'bolt') . '/public/' . $fileName;
      }
      else {
        return $fileName;
      }
    });
  }

  // @todo Deprecate & remove this whole `pattern_template` function
  public static function pattern_template() {
    return new Twig_SimpleFunction('pattern_template', function($patternName) {

      switch ($patternName) {
        case 'button_group':
          return '@bolt/button-group.twig';
        case 'button':
          return '@bolt/button.twig';
        case 'card':
          return '@bolt/card.twig';
        case 'card-w-teaser':
          return '@bolt/card-w-teaser.twig';
        case 'eyebrow':
          return '@bolt/eyebrow.twig';
        case 'flag':
          return '@bolt/flag.twig';
        case 'headline':
          return '@bolt/headline.twig';
        case 'image':
          return '@bolt/image.twig';
        case 'link':
          return '@bolt/link.twig';
        case 'teaser':
          return '@bolt/teaser.twig';
        case 'text':
          return '@bolt/text.twig';
        case 'video':
          return '@bolt/video.twig';
        default:
          return 'ERROR: Template not found: '. $patternName;
      }

      // the full list of `$patternName` that uses this is:
      //button - @bolt/button.twig
      //button_group - @bolt-button-group/button-group.twig
      //card - @bolt-card/card.twig
      //eyebrow - @bolt-headline/eyebrow.twig
      //flag - @bolt-global/flag.twig
      //headline - @bolt-headline/headline.twig
      //image - @bolt-global/image.twig
      //teaser - @bolt-teaser/teaser.twig
      //text - @bolt-headline/text.twig
      //video - @bolt-video/video.twig
    });
  }


  // returns an array with the results of the color contrast analysis
  // it returns akey for each level (AA and AAA, both for normal and large or bold text)
  // it also returns the calculated contrast ratio
  // the ratio levels are from the WCAG 2 requirements
  // http://www.w3.org/TR/WCAG20/#visual-audio-contrast (1.4.3)
  // http://www.w3.org/TR/WCAG20/#larger-scaledef
  public static function color_contrast() {
    return new Twig_SimpleFunction('color_contrast', function($color1, $color2) {
      $ratio = Colors::calculateLuminosityRatio($color1, $color2);

      $contrast["levelAANormal"] = ($ratio >= 4.5 ? 'pass' : 'fail');
      $contrast["levelAALarge"] = ($ratio >= 3 ? 'pass' : 'fail');
      $contrast["levelAAMediumBold"] = ($ratio >= 3 ? 'pass' : 'fail');
      $contrast["levelAAANormal"] = ($ratio >= 7 ? 'pass' : 'fail');
      $contrast["levelAAALarge"] = ($ratio >= 4.5 ? 'pass' : 'fail');
      $contrast["levelAAAMediumBold"] = ($ratio >= 4.5 ? 'pass' : 'fail');
      $contrast["ratio"] = $ratio;

      return $contrast;
    });
  }

  // Backport the native create_attribute function from Drupal to natively work in Pattern Lab
  public static function create_attribute() {
    return new Twig_SimpleFunction('create_attribute', function($attributes) {
      return is_array($attributes) ? new Attribute($attributes) : $attributes;
      // print_r(Attribute);
    });
  }

  // Custom function for merging Drupal Attribute objects
  // Gives $source preference, unless a key is set in both arrays and $source value is empty or null
  public static function merge_attributes() {
    return new Twig_SimpleFunction('merge_attributes', function($target, $source) {
      // For each key in $source...
      foreach ($source as $key => $value) {
        // If $key is not in $target, or if $key is in $target and $value in $source is empty, add/overwrite $key in $target
        // NOTE: empty() and is_null() do not work in the second half of this statement. Why is that?
        if (empty($target[$key]) || (!empty($target[$key]) && $value != "")) {
          $target[$key] = $value;
        }
      }

      return $target;
    });
  }

  public static function github_url() {
    return new Twig_SimpleFunction('github_url', function(\Twig_Environment $env, $twigPath) {
      $filePath = TwigTools\Utils::resolveTwigPath($env, $twigPath);
      return Utils::gitHubUrl($filePath);
    }, [
      'needs_environment' => true,
    ]);
  }

}
