#define _GNU_SOURCE 1
#include <ctype.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/cygwin.h>
#include <unistd.h>

#define iswinabspath(p)                                                        \
  (isalpha((unsigned)*(p)) && (p)[1] == ':' &&                                 \
   ((p)[2] == '/' || (p)[2] == '\\'))

static bool ends_with(const char *str, const char *suffix) {
  if (str == NULL || suffix == NULL) {
    return false;
  }

  size_t str_len = strlen(str);
  size_t suffix_len = strlen(suffix);

  // If the suffix is longer than the string, it cannot be a suffix
  if (suffix_len > str_len) {
    return false;
  }

  // Compare the final 'suffix_len' characters of 'str' with 'suffix'
  // memcmp is used for efficiency and correctness with null characters if they
  // were part of the data being compared strcmp can also be used as below
  // return strcmp(str + str_len - suffix_len, suffix) == 0;
  return memcmp(str + str_len - suffix_len, suffix, suffix_len) == 0;
}

int main(int argc, char **argv) {
  char newcmd[260] = "/usr/bin/";
  char *newargv[argc + 1];
  char *cmd_basename = basename(argv[0]);
  bool is_gcc = (strcmp(cmd_basename, "gcc") == 0) ||
                (strcmp(cmd_basename, "g++") == 0) ||
                ends_with(cmd_basename, "-gcc") ||
                ends_with(cmd_basename, "-g++");
  newargv[0] = strcat(newcmd, cmd_basename);
  for (int i = 1; i < argc; ++i) {
    char *arg = argv[i];
    const char linker_prefix[] = "-Wl,";
    const size_t linker_prefix_length = sizeof(linker_prefix) - 1;
    if (is_gcc && strncmp(linker_prefix, arg, linker_prefix_length) == 0) {
      const char *linker_arg = arg + linker_prefix_length;
      if (iswinabspath(linker_arg)) {
        char *posix_path = cygwin_create_path(CCP_WIN_A_TO_POSIX, linker_arg);
        newargv[i] = calloc(linker_prefix_length + strlen(posix_path) + 1, 1);
        strcat(newargv[i], linker_prefix);
        strcat(newargv[i], posix_path);
        free(posix_path);
      } else {
        newargv[i] = strdup(arg);
      }
    } else if (iswinabspath(arg)) {
      newargv[i] = cygwin_create_path(CCP_WIN_A_TO_POSIX, arg);
    } else {
      newargv[i] = strdup(arg);
    }
  }
  newargv[argc] = NULL;

#if 0
  printf("cmd_basename: %s\n", cmd_basename);
  for (int i = 0; i < argc; ++i) {
    printf("%s\n", newargv[i]);
  }
#endif
  execv(newargv[0], newargv);
  return 42;
}
